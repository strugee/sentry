import {Fragment, useCallback, useEffect} from 'react';
import type {RouteComponentProps} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import {useApiQuery} from 'sentry/utils/queryClient';

import IssueListActions from '../actions';

type RouteParams = {
  groupId: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

function GroupSimilarIssues({params}: Props) {
  const {groupId} = params;

  const fetchData = useCallback(() => {
    return useApiQuery([`/issues/${groupId}/related-issues/`, {}], {staleTime: 0});
  },

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Fragment>
      <Layout.Body>
        <Layout.Main fullWidth>
          <IssueListActions
            selection="null"
            query="issue.id:1"
            queryCount="0"
            statsPeriod="24h"
            groupIds="[1, 2]"
            allResultsVisible="true"
            displayReprocessingActions="false"
          />
          <p>Foo</p>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default GroupSimilarIssues;
