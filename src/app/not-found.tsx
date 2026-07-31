import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Compass className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Page not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              That page doesn&apos;t exist, or you may not have access to it.
            </p>
          </div>
          <Button render={<Link href="/">Go home</Link>} />
        </CardContent>
      </Card>
    </div>
  );
}
