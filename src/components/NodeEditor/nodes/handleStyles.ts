import { tv } from 'tailwind-variants'

export const handleRow = tv({
  slots: {
    row: 'flex items-center relative h-5',
    label: 'text-[10px] text-zinc-500 font-mono',
    labelTwo: 'text-[10px] text-yellow-500 font-mono',

  },
  variants: {
    side: {
      left: {
        row: 'justify-start',
        label: 'ml-2',
      },
      right: {
        row: 'justify-end',
        label: 'mr-2',
      },
    },
  },
  defaultVariants: {
    side: 'left',
  },
})
