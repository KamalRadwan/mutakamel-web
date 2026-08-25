import { InvoiceDetailScreen } from "@/features/admin/invoices/components/invoice-detail-screen";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;
  return <InvoiceDetailScreen invoiceId={id} />;
}
