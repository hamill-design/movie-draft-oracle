import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

export type Crumb = { name: string; path: string };

/**
 * Visible breadcrumb trail, styled for the dark theme. Presentational only — pages emit the
 * matching `BreadcrumbList` JSON-LD via `breadcrumbListNode()` using the same `items` array,
 * so the visible trail and structured data stay in sync from one source.
 *
 * The last item renders as the (non-clickable) current page. Renders nothing for <2 items.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length < 2) return null;

  return (
    <Breadcrumb className={cn('font-brockmann', className)}>
      <BreadcrumbList className="text-greyscale-blue-300">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={item.path}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="text-greyscale-blue-100">{item.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    asChild
                    className="text-greyscale-blue-300 transition-colors hover:text-greyscale-blue-50"
                  >
                    <Link to={item.path}>{item.name}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="text-greyscale-blue-400" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default Breadcrumbs;
