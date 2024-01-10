from datetime import timedelta
from uuid import uuid4

from sentry.api.endpoints.release_thresholds.health_checks.is_new_issues_count_healthy import (
    get_new_issue_count_is_healthy,
)
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format


class TestGetNewIssueCountIsHealthy(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.project1 = self.create_project(name="foo", organization=self.organization)
        self.project2 = self.create_project(name="bar", organization=self.organization)

        self.canary_environment = Environment.objects.create(
            organization_id=self.organization.id, name="canary"
        )
        self.production_environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )

        # release created for proj1, and proj2
        self.release1 = Release.objects.create(version="v1", organization=self.organization)
        # add_project get_or_creates a ReleaseProject
        self.release1.add_project(self.project1)
        self.release1.add_project(self.project2)

        # release created for proj1
        self.release2 = Release.objects.create(version="v2", organization=self.organization)
        self.release2.add_project(self.project1)

        # Attaches the release to a particular environment
        # project superfluous/deprecated in ReleaseEnvironment
        # release1 canary
        ReleaseEnvironment.objects.create(
            organization_id=self.organization.id,
            release_id=self.release1.id,
            environment_id=self.canary_environment.id,
        )
        # Release Project Environments are required to query releases by project
        # Even though both environment & project are here, this seems to just attach a release to a project
        # You can have multiple ReleaseProjectEnvironment's per release (this attaches multiple projects to the release&env)
        # release1 project1 canary
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release1.id,
            project_id=self.project1.id,
            environment_id=self.canary_environment.id,
        )
        # release1 project2 canary
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release1.id,
            project_id=self.project2.id,
            environment_id=self.canary_environment.id,
        )

        # release2 prod
        ReleaseEnvironment.objects.create(
            organization_id=self.organization.id,
            release_id=self.release2.id,
            environment_id=self.production_environment.id,
        )
        # release2 project1 prod
        ReleaseProjectEnvironment.objects.create(
            release_id=self.release2.id,
            project_id=self.project1.id,
            environment_id=self.production_environment.id,
        )

        self.new_issue_count_release_threshold = ReleaseThreshold.objects.create(
            threshold_type=ReleaseThresholdType.NEW_ISSUE_COUNT,
            trigger_type=1,
            value=2,
            window_in_seconds=100,
            project=self.project1,
            environment=self.canary_environment,
        )
        self._create_new_issues_for_release_threshold()

    def _create_new_issues_for_release_threshold(self) -> None:
        self.new_issue_time = self.new_issue_count_release_threshold.date_added + timedelta(
            seconds=10
        )
        for _ in range(2):
            self.store_event(
                project_id=self.new_issue_count_release_threshold.project.id,
                data={
                    "fingerprint": [str(uuid4())],
                    "timestamp": iso_format(self.new_issue_time),
                    "user": {"id": self.user.id, "email": self.user.email},
                    "release": self.release1.version,
                    "environment": self.canary_environment.name,
                },
            )

    def test_returns_true(self) -> None:
        start_time = self.new_issue_time - timedelta(seconds=10)
        end_time = self.new_issue_time + timedelta(seconds=10)
        is_healthy = get_new_issue_count_is_healthy(
            project=self.project1,
            release=self.release1,
            release_threshold=self.new_issue_count_release_threshold,
            start=start_time,
            end=end_time,
        )
        assert is_healthy is True

    def test_returns_false(self) -> None:
        # Get a time range when no issues are there
        start_time = self.new_issue_time + timedelta(hours=1)
        end_time = self.new_issue_time + timedelta(hours=2)
        is_healthy = get_new_issue_count_is_healthy(
            project=self.project1,
            release=self.release1,
            release_threshold=self.new_issue_count_release_threshold,
            start=start_time,
            end=end_time,
        )
        assert is_healthy is False

    def test_returns_false_when_no_issues_found(self) -> None:
        start_time = self.new_issue_time - timedelta(seconds=10)
        end_time = self.new_issue_time + timedelta(seconds=10)
        is_healthy = get_new_issue_count_is_healthy(
            project=self.project2,
            release=self.release1,
            release_threshold=self.new_issue_count_release_threshold,
            start=start_time,
            end=end_time,
        )
        assert is_healthy is False
