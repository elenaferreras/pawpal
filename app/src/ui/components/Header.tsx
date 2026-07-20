import type { ReactNode } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text, Heading } from "@astryxdesign/core/Text";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps): ReactNode {
  return (
    <HStack justify="between" vAlign="center" style={{ marginBottom: 16 }}>
      <VStack gap={0.5}>
        <Heading level={2}>{title}</Heading>
        {subtitle && <Text type="supporting">{subtitle}</Text>}
      </VStack>
      {action}
    </HStack>
  );
}
