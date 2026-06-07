import HomeLanding from "@/components/HomeLanding";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <HomeLanding locale={locale} />;
}
