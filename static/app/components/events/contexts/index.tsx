import {Fragment, useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contextSummary/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import {Chunk} from './chunk';

type Props = {
  event: Event;
  group?: Group;
};

export function EventContexts({event, group}: Props) {
  const hasNewTagsUI = useHasNewTagsUI();
  const {user, contexts, sdk} = event;

  const {feedback, response, ...otherContexts} = contexts ?? {};

  const usingOtel = useCallback(
    () => otherContexts.otel !== undefined,
    [otherContexts.otel]
  );

  useEffect(() => {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (transaction && usingOtel()) {
      transaction.tags.otel_event = true;
      transaction.tags.otel_sdk = sdk?.name;
      transaction.tags.otel_sdk_version = sdk?.version;
    }
  }, [usingOtel, sdk]);

  const contextContent = (
    <Fragment>
      {!objectIsEmpty(response) && (
        <Chunk
          key="response"
          type="response"
          alias="response"
          group={group}
          event={event}
          value={response}
        />
      )}
      {!objectIsEmpty(feedback) && (
        <Chunk
          key="feedback"
          type="feedback"
          alias="feedback"
          group={group}
          event={event}
          value={feedback}
        />
      )}
      {user && !objectIsEmpty(user) && (
        <Chunk
          key="user"
          type="user"
          alias="user"
          group={group}
          event={event}
          value={user}
        />
      )}
      {Object.entries(otherContexts).map(([key, value]) => (
        <Chunk
          key={key}
          type={value?.type ?? ''}
          alias={key}
          group={group}
          event={event}
          value={value}
        />
      ))}
    </Fragment>
  );

  if (hasNewTagsUI) {
    return (
      <EventDataSection
        key={'context'}
        type={'context'}
        title={t('Context')}
        help={tct('The structured contexts attached to this event. [link:Learn more]', {
          link: <ExternalLink openInNewTab href={CONTEXT_DOCS_LINK} />,
        })}
      >
        {contextContent}
      </EventDataSection>
    );
  }
  return contextContent;
}
