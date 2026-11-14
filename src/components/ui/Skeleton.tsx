export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden />;
}
export function PageSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading page">
      <Skeleton h={36} w={320} />
      <Skeleton h={18} w="60%" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Skeleton h={180} />
        <Skeleton h={180} />
        <Skeleton h={180} />
      </div>
      <Skeleton h={300} />
    </div>
  );
}
