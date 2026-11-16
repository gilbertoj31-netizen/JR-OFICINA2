import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection in server:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception in server:", err);
});

const TOKENS_FILE = path.join(process.cwd(), "bling_tokens.json");

interface BlingTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function saveTokens(tokens: BlingTokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens));
}

function loadTokens(): BlingTokens | null {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
  } catch (err) {
    return null;
  }
}

async function getValidToken() {
  const staticToken = process.env.BLING_API_TOKEN;
  if (staticToken) return staticToken;

  let tokens = loadTokens();
  if (!tokens) return null;

  // Check if token is expired (with 30s margin)
  if (Date.now() < tokens.expires_at - 30000) {
    return tokens.access_token;
  }

  // Refresh token
  console.log("Token do Bling expirado. Tentando renovar...");
  try {
    const clientId = process.env.BLING_CLIENT_ID;
    const clientSecret = process.env.BLING_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Client ID ou Secret ausentes");
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${authHeader}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Erro ao renovar token Bling:", err);
      return null;
    }

    const data = await response.json();
    const newTokens: BlingTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };
    saveTokens(newTokens);
    return newTokens.access_token;
  } catch (error) {
    console.error("Exceção ao renovar token Bling:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Iniciar a escuta na porta 3000 imediatamente para evitar 502 / warmup timeout no Cloud Run
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`JR BIKE SHOP Server rodando em http://localhost:${PORT}`);
  });

  app.use(express.json());

  // Health check endpoint para sondas de prontidão do contêiner
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- OAuth Bling V3 ---

  function getRedirectUri(req: express.Request) {
    // Priority: APP_URL env var, then x-forwarded headers, then fallback
    const baseUrl = process.env.APP_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.get('host')}`;
    // Remove trailing slash if exists in baseUrl
    const cleanedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanedBaseUrl}/api/auth/bling/callback`;
  }

  app.get("/api/auth/bling/status", async (req, res) => {
    const token = await getValidToken();
    res.json({ connected: !!token });
  });

  app.get("/api/auth/bling/redirect-uri", (req, res) => {
    res.json({ redirectUri: getRedirectUri(req) });
  });

  app.get("/api/bling/test", async (req, res) => {
    const apiToken = await getValidToken();
    if (!apiToken) return res.status(401).json({ error: "Bling não conectado" });

    try {
      const urlAll = `https://www.bling.com.br/Api/v3/produtos?limite=1&criterio=3`;
      const urlDep = `https://www.bling.com.br/Api/v3/depositos`;
      
      const [resAll, resDep] = await Promise.all([
        fetch(urlAll, { headers: { 'Authorization': `Bearer ${apiToken}` } }),
        fetch(urlDep, { headers: { 'Authorization': `Bearer ${apiToken}` } })
      ]);
      
      const debug: any = {
        prodStatus: resAll.status,
        depStatus: resDep.status
      };

      let totalItens = 0;
      let nomePrimeiro = 'Nenhum';
      
      if (resAll.ok) {
        const dataAll = await resAll.json();
        totalItens = dataAll.data?.length || 0;
        nomePrimeiro = dataAll.data?.[0]?.nome || 'Nenhum';
      } else {
        debug.prodError = await resAll.json().catch(() => "Erro não-JSON");
      }

      let temDepositos = false;
      if (resDep.ok) {
        const dataDep = await resDep.json();
        temDepositos = !!dataDep.data?.length;
      } else {
        debug.depError = await resDep.json().catch(() => "Erro não-JSON");
      }
      
      res.json({ 
        status: resAll.ok && resDep.ok ? "ok" : "parcial", 
        totalItens,
        temDepositos,
        nomePrimeiro,
        debug
      });
    } catch (error: any) {
      console.error("Erro no diagnóstico Bling:", error);
      res.status(500).json({ error: typeof error.message === 'string' ? error.message : "Erro interno no diagnóstico" });
    }
  });

  app.get("/api/auth/bling/url", (req, res) => {
    const clientId = process.env.BLING_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "BLING_CLIENT_ID não configurado" });
    }

    const redirectUri = getRedirectUri(req);
    console.log(`OAuth Bling - Gerando URL de autorização. Redirect URI: ${redirectUri}`);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "produtos estoque vendas", 
      state: "bling_auth_state_jr_bike", // Parâmetro obrigatório pelo Bling V3
    });

    const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get(["/api/auth/bling/callback", "/api/auth/bling/callback/"], async (req, res) => {
    console.log(`Bling Callback disparado! URL: ${req.url}`);
    console.log(`Query Params: ${JSON.stringify(req.query)}`);
    
    const { code, error, error_description } = req.query;
    const clientId = process.env.BLING_CLIENT_ID;
    const clientSecret = process.env.BLING_CLIENT_SECRET;

    if (error) {
      return res.status(400).send(`Erro do Bling: ${error}. Descrição: ${error_description || 'Nenhuma'}`);
    }

    if (!code) {
      return res.status(400).send("Erro: Código de autorização não recebido do Bling. Verifique se você clicou em 'Autorizar'.");
    }
    
    if (!clientId || !clientSecret) {
      return res.status(400).send("Erro: BLING_CLIENT_ID ou BLING_CLIENT_SECRET não configurados nos Secrets (Ambiente) do AI Studio.");
    }

    try {
      const currentRedirectUri = getRedirectUri(req);
      console.log(`OAuth Bling - Iniciando troca de token. Redirect URI: ${currentRedirectUri}`);
      
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: currentRedirectUri,
      });

      console.log("Enviando POST para Bling token exchange...");
      const response = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${authHeader}`,
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Erro na troca de código Bling - Status:", response.status);
        console.error("Conteúdo do erro:", errText);
        
        let errorData;
        try {
          errorData = JSON.parse(errText);
        } catch (e) {
          errorData = { raw: errText };
        }

        return res.status(500).send(`
          <h2>Erro na Autenticação com o Bling</h2>
          <p>O Bling retornou um erro ao tentar finalizar a conexão.</p>
          <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd;">
${JSON.stringify(errorData, null, 2)}
          </pre>
          <p><strong>Dica:</strong> Verifique se o Client ID e Client Secret nos "Secrets" do AI Studio estão corretos.</p>
          <p><strong>Redirect URI usado:</strong> <code>${currentRedirectUri}</code></p>
        `);
      }

      const data = await response.json();
      saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      });

      // HTML para fechar o popup e avisar o app principal
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white;">
            <div style="text-align: center;">
              <h2>Conexão com Bling feita com sucesso!</h2>
              <p>Esta janela fechará sozinha...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'BLING_AUTH_SUCCESS' }, '*');
                  setTimeout(() => window.close(), 1500);
                } else {
                  window.location.href = '/';
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Exceção no callback do Bling:", error);
      res.status(500).send("Erro interno ao processar autenticação.");
    }
  });

  // API do Bling - Proxy Seguro (V3)
  app.get("/api/bling/products", async (req, res) => {
    const apiToken = await getValidToken();
    const searchTerm = req.query.q || '';

    if (!apiToken) {
      console.error("ERRO: O Bling não está conectado. Use o OAuth primeiro.");
      return res.status(401).json({ error: "Bling não conectado", needsAuth: true });
    }

    try {
      // Bling API V3 - Busca Total
      // Criterio 3 (Todos) e incluindo situacao T (Todos)
      const url = `https://www.bling.com.br/Api/v3/produtos?nome=${encodeURIComponent(searchTerm as string)}&limite=50&criterio=3`;
      
      console.log(`Buscando no Bling V3 (Total): ${searchTerm}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Bling V3 respondeu com status: ${response.status}`, errorData);
        return res.status(response.status).json({ 
          error: "Erro na conexão com o Bling V3",
          details: errorData 
        });
      }

      const data = await response.json();
      
      // Normalizando os dados
      const products = data.data?.map((p: any) => {
        // Bling V3 pode retornar o preço em campos diferentes dependendo da configuração
        const preco = parseFloat(p.preco) || parseFloat(p.precoCusto) || 0;
        
        return {
          id: (p.id || '').toString(),
          nome: p.nome || 'Produto sem nome',
          preco: preco,
          codigo: p.codigo || ''
        };
      }) || [];

      console.log(`Encontrados ${products.length} produtos no V3.`);
      res.json({ data: products });
    } catch (error: any) {
      console.error("Exceção na integração com Bling V3:", error);
      const errorMessage = error?.message || "Erro interno no servidor ao tentar acessar o Bling V3";
      res.status(500).json({ error: typeof errorMessage === 'string' ? errorMessage : "Erro desconhecido" });
    }
  });

  // API 404 handler for unmatched API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "Endpoint de API não encontrado" });
  });

  // Configuração do Vite
  if (process.env.NODE_ENV !== "production") {
    let viteMiddleware: express.RequestHandler | null = null;
    const vitePromise = import("vite").then(({ createServer }) =>
      createServer({
        server: { middlewareMode: true },
        appType: "spa",
      })
    ).then((vite) => {
      viteMiddleware = vite.middlewares;
      console.log("Vite dev middleware pronto para atender requisições.");
      return vite;
    }).catch((err) => {
      console.error("Erro ao inicializar o Vite:", err);
      throw err;
    });

    app.use(async (req, res, next) => {
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      try {
        const vite = await vitePromise;
        return vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer().catch((err) => {
  console.error("Falha fatal ao iniciar o servidor:", err);
  process.exit(1);
});
