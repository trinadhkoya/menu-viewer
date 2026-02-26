interface BreadcrumbItem {
  label: string;
  ref?: string;
  type: 'root' | 'category' | 'product';
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onClick: (item: BreadcrumbItem) => void;
}

export function Breadcrumb({ items, onClick }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb">
      {items.map((item, index) => (
        <span key={index} className="breadcrumb-item">
          {index > 0 && <span className="breadcrumb-separator">›</span>}
          <button
            className={`breadcrumb-link ${index === items.length - 1 ? 'breadcrumb-link--active' : ''}`}
            onClick={() => onClick(item)}
            disabled={index === items.length - 1}
          >
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
