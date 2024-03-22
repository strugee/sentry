import styled from '@emotion/styled';

import {getTitle} from 'sentry/components/events/contexts/utils';
import Panel from 'sentry/components/panels/panel';
import {StructuredData} from 'sentry/components/structuredEventData';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

interface ContextCardProps {
  alias: string;
  event: Event;
  type: string;
  group?: Group;
  value?: Record<string, any>;
}

function ContextCard({alias, type, value = {}}: ContextCardProps) {
  if (objectIsEmpty(value)) {
    return null;
  }

  const content = Object.entries(value).map(([contextKey, contextValue], i) => {
    if (contextKey === 'type') {
      return null;
    }
    return (
      <ContextContent key={i}>
        <ContextKey>{contextKey}</ContextKey>
        <ContextValue>
          <StructuredData
            value={contextValue}
            withAnnotatedText={false}
            depth={0}
            maxDefaultDepth={0}
            meta={{}}
            config={{}}
          />
        </ContextValue>
      </ContextContent>
    );
  });

  return (
    <Card>
      <ContextTitle>{getTitle({alias, type, value})}</ContextTitle>
      {content}
    </Card>
  );
}

const Card = styled(Panel)`
  padding: ${space(0.75)};
  display: grid;
  column-gap: ${space(1.5)};
  grid-template-columns: minmax(100px, auto) 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const ContextTitle = styled('p')`
  grid-column: span 2;
  padding: ${space(0.25)} ${space(0.75)};
  margin: 0;
  color: ${p => p.theme.headingColor};
  font-weight: bold;
`;

const ContextContent = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: span 2;
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 4px;
  &:nth-child(odd) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const ContextKey = styled('div')`
  grid-column: 1 / 2;
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.familyMono};
`;

const ContextValue = styled('div')`
  grid-column: 2 / 3;
  font-family: ${p => p.theme.text.familyMono};
`;

export default ContextCard;
