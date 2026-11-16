export interface Customer {
  id?: string;
  name: string;
  whatsapp: string;
  email?: string;
  address?: string;
  bikeModel?: string;
  lastServiceDate?: string;
  createdBy: string;
  createdAt: any;
}

export interface AppSettings {
  id?: string;
  pixKey: string;
  pixCity?: string;
  storeName: string;
  phone: string;
  address: string;
  receiptFooter: string;
  updatedBy: string;
  updatedAt: any;
}

export interface ServiceItem {
  id: string;
  name: string;
  defect: boolean;
  replace: boolean;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ServiceOrder {
  id?: string;
  customerName: string;
  bikeModel: string;
  mechanicName: string;
  whatsapp: string;
  date: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  paymentStatus: 'Pendente' | 'Pago';
  items: ServiceItem[];
  laborCost: number;
  washCost: number;
  discount: number;
  total: number;
  observations: string;
  createdBy: string;
  createdAt: any;
}

export interface Appointment {
  id?: string;
  customerName: string;
  whatsapp: string;
  bikeModel?: string;
  serviceType: string;
  date: string;
  time: string;
  status: 'Agendado' | 'Confirmado' | 'Em Atendimento' | 'Concluído' | 'Cancelado';
  notes?: string;
  createdBy: string;
  createdAt: any;
  convertedToOSId?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
