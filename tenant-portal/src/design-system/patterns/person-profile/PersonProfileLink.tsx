"use client";

import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../../primitives/Avatar";
import { Button } from "../../primitives/Button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../../primitives/Dialog";
import { Skeleton } from "../../primitives/Skeleton";
import { cn } from "../../lib/cn";

export interface PersonProfile {
  fullName: string;
  imageUrl?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PersonProfileLinkProps {
  person: PersonProfile;
  previous?: boolean;
  loading?: boolean;
  placeholder?: boolean;
  notice?: ReactNode;
  onRetry?: () => void;
  labels: {
    open: string; description: string; phone: string; email: string;
    unavailable: string; close: string; retry: string;
  };
}

/** Shared name trigger + contact card. Radix owns focus trapping and restoration. */
export function PersonProfileLink({ person, labels, previous, loading, placeholder, notice, onRetry }: PersonProfileLinkProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="xs" aria-label={labels.open} aria-busy={loading || undefined}
          className={cn("h-auto whitespace-normal text-start text-xs font-normal", previous && "line-through")}>
          <bdi>{person.fullName}</bdi>
        </Button>
      </DialogTrigger>
      <DialogContent size="sm" closeLabel={labels.close} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto">
        <div className="flex items-center gap-3 pe-6">
          <Avatar className="size-16">
            {person.imageUrl && <AvatarImage src={person.imageUrl} alt={person.fullName} />}
            <AvatarFallback>
              {!placeholder && person.fullName.trim() ? <span className="text-lg">{person.fullName.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]).join("")}</span>
                : <UserRound className="size-7" aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <DialogTitle className="break-words text-base"><bdi>{person.fullName}</bdi></DialogTitle>
            <DialogDescription className="text-sm">{labels.description}</DialogDescription>
          </div>
        </div>
        {loading ? <div className="space-y-3" role="status" aria-label={person.fullName}><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-2/3" /></div>
          : <dl className="grid gap-3 border-t border-border pt-3 text-sm">
            <div className="grid gap-1"><dt className="text-muted-foreground">{labels.phone}</dt>
              <dd className="break-words text-foreground"><bdi>{person.phone || labels.unavailable}</bdi></dd></div>
            <div className="grid gap-1"><dt className="text-muted-foreground">{labels.email}</dt>
              <dd className="break-words text-foreground"><bdi>{person.email || labels.unavailable}</bdi></dd></div>
          </dl>}
        {notice && <div role="status" className="text-sm text-muted-foreground">{notice}</div>}
        <DialogFooter>
          {onRetry && <Button onClick={onRetry}>{labels.retry}</Button>}
          <DialogClose asChild><Button>{labels.close}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
