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
    <div className={cn('w-full p-4 sm:p-6', className)}>
      <Breadcrumb className="font-brockmann">
        <BreadcrumbList className="min-h-[44px] w-full gap-[10px] rounded-lg bg-purple-800 px-[18px] py-3 text-[14px] leading-5 text-[#A496FF] sm:gap-[10px]">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <Fragment key={item.path}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="font-normal text-[#FCFFFF]">{item.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      asChild
                      className="text-[#A496FF] transition-colors hover:text-[#FCFFFF]"
                    >
                      <Link to={item.path}>{item.name}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <BreadcrumbSeparator className="text-[#7E5EFF] [&>svg]:h-[14px] [&>svg]:w-[14px]" />
                )}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export default Breadcrumbs;
