import clsx from 'clsx'

export function Panel({ className, ...props }: React.ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      {...props}
      className={clsx(
        className,
        'rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10'
      )}
    />
  )
}
