import { CategoriesWorkspace } from "../components/categories-workspace";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CategoriesWorkspace initialId={id} />;
}
