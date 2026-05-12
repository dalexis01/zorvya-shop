import ProductEditorForm from "@/components/admin/ProductEditorForm";

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProductEditorForm mode="edit" productId={id} />;
}
