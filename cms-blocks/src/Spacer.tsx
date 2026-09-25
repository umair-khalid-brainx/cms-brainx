import type { SpacerBlock } from './types';

const HEIGHTS: Record<SpacerBlock['size'], string> = {
  sm: '2rem',
  md: '4rem',
  lg: '8rem',
};

export function Spacer({ block }: { block: SpacerBlock }) {
  return <div style={{ height: HEIGHTS[block.size] }} aria-hidden="true" />;
}
