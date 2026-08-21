import { redirect } from "next/navigation";

const assistantUrl =
  "https://robot.chaoxing.com/prime?unitId=1275&robotId=53b6aaebaaf5447f9c040aa5aab640e5";

export default function AssistantPage() {
  redirect(assistantUrl);
}
