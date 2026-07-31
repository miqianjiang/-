import { redirect } from "next/navigation";

const assistantUrl =
  "https://robot.chaoxing.com/prime?unitId=1275&robotId=7b338884debd4d9996745d126772ee98";

export default function AssistantPage() {
  redirect(assistantUrl);
}
