from functools import cached_property

from django.urls import reverse

from sentry.incidents.models.incident import IncidentSeen
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationIncidentSeenTest(APITestCase):
    method = "post"
    endpoint = "sentry-api-0-organization-incident-seen"

    def setUp(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

    @cached_property
    def organization(self):
        return self.create_organization(owner=self.create_user())

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
    def user(self):
        return self.create_user()

    def test_has_user_seen(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.identifier)

            assert resp.status_code == 201

            # should not be seen by different user
            new_user = self.create_user()
            self.create_member(user=new_user, organization=self.organization, teams=[self.team])
            self.login_as(new_user)

            seen_incidents = IncidentSeen.objects.filter(incident=incident)
            assert len(seen_incidents) == 1
            assert seen_incidents[0].user_id == self.user.id

            # mark set as seen by new_user
            resp = self.get_response(incident.organization.slug, incident.identifier)
            assert resp.status_code == 201

            seen_incidents = IncidentSeen.objects.filter(incident=incident)
            assert len(seen_incidents) == 2
            assert seen_incidents[0].user_id == self.user.id
            assert seen_incidents[1].user_id == new_user.id

            url = reverse(
                "sentry-api-0-organization-incident-details",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_identifier": incident.identifier,
                },
            )

            resp = self.client.get(url, format="json")
            assert resp.status_code == 200
            assert resp.data["hasSeen"]

            assert len(resp.data["seenBy"]) == 2
            # seenBy is sorted by most recently seen
            assert resp.data["seenBy"][0]["username"] == new_user.username
            assert resp.data["seenBy"][1]["username"] == self.user.username
