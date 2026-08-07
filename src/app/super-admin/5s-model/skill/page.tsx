import { requireRole } from "@/lib/auth/dal";
import { getFiveSTests } from "@/lib/five-s/catalog";
import { BenchmarkTestScaffold } from "@/components/five-s/benchmark-test-scaffold";

export default async function SuperAdminSkillBenchmarksPage() {
  await requireRole("super_admin");
  const tests = await getFiveSTests();

  return (
    <BenchmarkTestScaffold
      categoryLabel="Skill"
      tests={tests.filter((t) => t.category === "skill")}
    />
  );
}
