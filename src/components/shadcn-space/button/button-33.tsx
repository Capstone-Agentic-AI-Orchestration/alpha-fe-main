import { Sparkles } from 'lucide-react';
import { Button, type ButtonProps } from '@/shared/components/ui/button';

export default function GenerateAIButton({ children, className, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="outline"
    className={'relative h-10 overflow-hidden rounded-full border-transparent px-6 text-content ' + (className ?? '')}>
    <span className="star-trail-button-border" aria-hidden="true" />
    <span className="relative z-10 flex items-center gap-2">
      {children ?? <><Sparkles size={16} fill="currentColor" aria-hidden="true" />Generate</>}
    </span>
  </Button>;
}
