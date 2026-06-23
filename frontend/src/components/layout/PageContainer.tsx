interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/** Consistent responsive page padding */
export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10 ${className}`}>
      {children}
    </div>
  );
}
