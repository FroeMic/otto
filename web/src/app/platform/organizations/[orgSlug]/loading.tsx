import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-8">
      <Spinner />
    </div>
  );
}
