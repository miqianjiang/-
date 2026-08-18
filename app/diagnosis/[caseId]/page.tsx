import { notFound } from "next/navigation";
import DiagnosisTrainer from "@/components/diagnosis/DiagnosisTrainer";
import { protectionCases } from "@/lib/protection-logic/cases";

export function generateStaticParams() {
  return protectionCases.map((item) => ({
    caseId: item.id
  }));
}

export default async function DiagnosisCasePage({
  params
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const matchedCase = protectionCases.find((item) => item.id === caseId);

  if (!matchedCase) {
    notFound();
  }

  return <DiagnosisTrainer initialCaseId={matchedCase.id} />;
}
