import { ReactNode } from 'react';
import { CodeBlock } from '../CodeBlock';
import { Text } from '@backstage/canon';
import { Collapsible } from '@base-ui-components/react/collapsible';
import styles from './styles.module.css';

interface SnippetProps {
  preview: ReactNode;
  code: string;
  align?: 'left' | 'center';
  px?: number;
  py?: number;
  open?: boolean;
}

export const Snippet = ({
  preview,
  code = '',
  align = 'left',
  px = 2,
  py = 2,
  open = false,
}: SnippetProps) => {
  return (
    <Collapsible.Root className={styles.container} defaultOpen={open}>
      <div
        className={`${styles.preview} ${styles[align]}`}
        style={{ padding: `${py}rem ${px}rem` }}
      >
        {preview}
        <Collapsible.Trigger className={styles.trigger}>
          <Text variant="body">View code</Text>
        </Collapsible.Trigger>
      </div>
      <Collapsible.Panel className={styles.Panel}>
        <CodeBlock code={code} />
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};
