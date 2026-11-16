import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency } from './utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generatePixPayload } from './pixUtils';

export const generateOSPDF = async (order: ServiceOrder) => {
  const pdfDoc = new jsPDF();
  const pageWidth = pdfDoc.internal.pageSize.getWidth();

  // Fetch Settings
  let settings: AppSettings = {
    pixKey: '',
    storeName: 'JR BIKE SHOP',
    phone: '',
    address: '',
    receiptFooter: 'JR BIKE SHOP - OBRIGADO PELA PREFERÊNCIA!',
    updatedBy: '',
    updatedAt: null
  };

  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    if (settingsSnap.exists()) {
      settings = settingsSnap.data() as AppSettings;
    }
  } catch (e) {
    console.error("Error fetching settings for PDF:", e);
  }

  // Header
  pdfDoc.setFillColor(0, 0, 0);
  pdfDoc.rect(0, 0, pageWidth, 40, 'F');
  
  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFontSize(24);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text(settings.storeName, 15, 20);
  
  pdfDoc.setFontSize(10);
  pdfDoc.setFont('helvetica', 'normal');
  pdfDoc.text('OFICINA E REVISÃO DE BICICLETAS', 15, 30);

  if (settings.phone) {
    pdfDoc.setFontSize(8);
    pdfDoc.text(`Tel: ${settings.phone}`, pageWidth - 15, 20, { align: 'right' });
  }

  // Client Info
  pdfDoc.setTextColor(0, 0, 0);
  pdfDoc.setFontSize(14);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text('INFORMAÇÕES DO CLIENTE', 15, 55);

  pdfDoc.setFontSize(10);
  pdfDoc.setFont('helvetica', 'normal');
  const infoY = 65;
  pdfDoc.text(`Cliente: ${order.customerName}`, 15, infoY);
  pdfDoc.text(`Bicicleta: ${order.bikeModel}`, 15, infoY + 6);
  pdfDoc.text(`Mecânico: ${order.mechanicName || 'Não informado'}`, 15, infoY + 12);
  pdfDoc.text(`WhatsApp: ${order.whatsapp || 'Não informado'}`, 15, infoY + 18);
  pdfDoc.text(`Data: ${format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}`, 15, infoY + 24);
  pdfDoc.text(`Status OS: ${order.status}`, 15, infoY + 30);
  pdfDoc.text(`Pagamento: ${order.paymentStatus || 'Pendente'}`, 15, infoY + 36);

  // Filter items that have a price or quantity > 0 and subtotal > 0
  const usedItems = order.items.filter(item => item.subtotal > 0);

  // Items Table
  const tableData = usedItems.map(item => [
    item.name,
    item.description || '-',
    item.quantity,
    formatCurrency(item.unitPrice),
    formatCurrency(item.subtotal)
  ]);

  // Add Labor and Wash to table if they have values
  if (order.laborCost > 0) {
    tableData.push(['MÃO DE OBRA', '-', '1', formatCurrency(order.laborCost), formatCurrency(order.laborCost)]);
  }
  if (order.washCost > 0) {
    tableData.push(['LAVAGEM', '-', '1', formatCurrency(order.washCost), formatCurrency(order.washCost)]);
  }
  if (order.discount > 0) {
    tableData.push(['DESCONTO', '-', '1', `-${formatCurrency(order.discount)}`, `-${formatCurrency(order.discount)}`]);
  }

  autoTable(pdfDoc, {
    startY: 105,
    head: [['Peça / Serviço', 'Descrição', 'Qtd', 'Preço Un.', 'Subtotal']],
    body: tableData,
    headStyles: { fillColor: [0, 255, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9 }
  });

  // Totals
  const finalY = (pdfDoc as any).lastAutoTable.finalY + 15;
  pdfDoc.setFontSize(16);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text(`VALOR TOTAL: ${formatCurrency(order.total)}`, pageWidth - 15, finalY, { align: 'right' });

  // Payment Info (PIX)
  if (settings.pixKey && order.paymentStatus === 'Pendente') {
    pdfDoc.setFillColor(240, 255, 240);
    pdfDoc.rect(15, finalY + 5, pageWidth - 30, 25, 'F');
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(0, 100, 0);
    pdfDoc.text('PAGAMENTO VIA PIX:', 20, finalY + 15);
    pdfDoc.setFontSize(12);
    pdfDoc.text(settings.pixKey, 20, finalY + 23);
    
    // QR Code API (Public)
    const pixPayload = generatePixPayload(
      settings.pixKey, 
      settings.storeName, 
      settings.pixCity || 'SAO PAULO', 
      order.total
    );
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pixPayload)}`;
    
    try {
      // Fetch image as blob and convert to dataURL for better PDF reliability
      const imgResp = await fetch(qrUrl);
      const blob = await imgResp.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      pdfDoc.addImage(dataUrl, 'PNG', pageWidth - 45, finalY + 7, 20, 20);
    } catch (qrErr) {
      console.error("Erro ao carregar QR Code para o PDF:", qrErr);
      // Fallback: Just display a message or leave blank
    }
  }

  // Observations
  let obsY = finalY + 40;
  if (order.observations) {
    pdfDoc.setFontSize(12);
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text('OBSERVAÇÕES:', 15, obsY);
    pdfDoc.setFontSize(10);
    pdfDoc.setFont('helvetica', 'normal');
    const splitObs = pdfDoc.splitTextToSize(order.observations, pageWidth - 30);
    pdfDoc.text(splitObs, 15, obsY + 8);
  }

  // Footer
  pdfDoc.setFontSize(8);
  pdfDoc.setTextColor(150, 150, 150);
  pdfDoc.text(settings.receiptFooter, pageWidth / 2, pdfDoc.internal.pageSize.getHeight() - 10, { align: 'center' });

  pdfDoc.save(`OS_${settings.storeName.replace(/\s+/g, '_')}_${order.customerName.replace(/\s+/g, '_')}.pdf`);
};

export const sendWhatsAppNotification = (order: ServiceOrder) => {
  if (!order.whatsapp) return;
  
  const phone = order.whatsapp.replace(/\D/g, '');
  const message = `Olá ${order.customerName}! Sua bicicleta (${order.bikeModel}) está pronta na JR BIKE SHOP. 
Status OS: ${order.status}
Pagamento: ${order.paymentStatus || 'Pendente'}
Total: ${formatCurrency(order.total)}
Obrigado pela preferência!`;

  const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};
