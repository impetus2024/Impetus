import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getFiveSTests, getFiveSQuestions } from "@/lib/five-s/catalog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FIVE_S_CATEGORIES } from "./categories";

export default async function SuperAdmin5sModelPage() {
  await requireRole("super_admin");

  const [tests, questions] = await Promise.all([getFiveSTests(), getFiveSQuestions()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">5S Model</h1>
        <p className="text-sm text-muted-foreground">
          Set the performance benchmarks each test is scored against, per age.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIVE_S_CATEGORIES.map((c) => {
          const count =
            c.slug === "spirit"
              ? questions.filter((q) => q.category === c.slug).length
              : tests.filter((t) => t.category === c.slug).length;

          return (
            <Card key={c.slug}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-muted-foreground" />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {count} {c.slug === "spirit" ? "questions" : "tests"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/super-admin/5s-model/${c.slug}`}>Manage</Link>}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
