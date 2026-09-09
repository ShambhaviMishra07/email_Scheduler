export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
      <div className="text-5xl mb-3">📭</div>
      <p className="font-medium text-gray-600">{title}</p>
      <p className="text-sm">{subtitle}</p>
    </div>
  );
}