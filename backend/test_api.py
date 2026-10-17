"""Self-contained integration tests for the backend task graph API."""
from fastapi.testclient import TestClient
from app.main import app

TEST_HEADERS = {"X-Workspace-User": "integration-test@cityniat.local"}


def run_tests():
    with TestClient(app) as client:
        # The app intentionally starts with an empty workspace; create the fixture graph explicitly.
        res = client.post('/api/missions/reset-sample', headers=TEST_HEADERS)
        assert res.status_code == 200, f"Reset sample failed: {res.text}"

        res = client.get('/api/health')
        assert res.status_code == 200, f"Health failed: {res.text}"
        print("1. Health OK:", res.json()["status"])

        res = client.get('/api/missions', headers=TEST_HEADERS)
        assert res.status_code == 200, f"List missions failed: {res.text}"
        missions = res.json()
        assert len(missions) > 0, "Fixture mission was not created"
        m_id = missions[0]["id"]
        print(f"2. Missions OK: found {len(missions)} mission(s), active: {m_id}")

        res = client.get(f'/api/missions/{m_id}', headers=TEST_HEADERS)
        assert res.status_code == 200, f"Get mission failed: {res.text}"
        m_detail = res.json()
        print(f"3. Graph OK: {len(m_detail['tasks'])} tasks, {len(m_detail['edges'])} edges")

        res = client.post(f'/api/missions/{m_id}/edges', json={"source": "task-runbook", "target": "task-venue"}, headers=TEST_HEADERS)
        assert res.status_code == 400, f"Expected cycle rejection but got {res.status_code}: {res.text}"
        print("4. Cycle Rejection OK:", res.json()["detail"])

        res = client.post(f'/api/missions/{m_id}/edges', json={"source": "task-venue", "target": "task-ghost"}, headers=TEST_HEADERS)
        assert res.status_code == 400, f"Expected nonexistent node rejection but got {res.status_code}: {res.text}"
        print("5. Nonexistent Node Rejection OK:", res.json()["detail"])

        res = client.post(f'/api/missions/{m_id}/edges', json={"source": "task-venue", "target": "task-venue"}, headers=TEST_HEADERS)
        assert res.status_code == 400, f"Expected self-loop rejection but got {res.status_code}: {res.text}"
        print("6. Self-loop Rejection OK:", res.json()["detail"])

        res = client.post('/api/missions', json={"goal": "Launch Hybrid AI Meetup", "brief": "100 person developer meetup"}, headers=TEST_HEADERS)
        assert res.status_code == 201, f"Create mission failed: {res.text}"
        new_m = res.json()
        print("7. Create Mission OK:", new_m["id"], new_m["goal"])

        task_payload = {
            "title": "Book Coworking Lounge", "description": "Reserve space for 100 people",
            "category": "venue", "priority": "high", "status": "pending",
            "owner": "Meetup Lead", "eta": "Nov 1", "position": {"x": 100, "y": 150}
        }
        res = client.post(f"/api/missions/{new_m['id']}/tasks", json=task_payload, headers=TEST_HEADERS)
        assert res.status_code == 201, f"Create task failed: {res.text}"
        new_t1 = res.json()
        task_payload.update({"title": "Announce RSVP on Luma", "description": "Publish ticketing link", "category": "marketing", "priority": "medium", "owner": "Marketing Lead", "eta": "Nov 5", "position": {"x": 400, "y": 150}})
        res = client.post(f"/api/missions/{new_m['id']}/tasks", json=task_payload, headers=TEST_HEADERS)
        assert res.status_code == 201, f"Create task 2 failed: {res.text}"
        new_t2 = res.json()
        print("8. Create Tasks OK:", new_t1["id"], new_t2["id"])

        edge_payload = {"source": new_t1["id"], "target": new_t2["id"]}
        res = client.post(f"/api/missions/{new_m['id']}/edges", json=edge_payload, headers=TEST_HEADERS)
        assert res.status_code == 201, f"Add edge failed: {res.text}"
        print("9. Add Edge OK:", res.json()["id"])
        res = client.post(f"/api/missions/{new_m['id']}/edges", json=edge_payload, headers=TEST_HEADERS)
        assert res.status_code == 409, f"Expected 409 conflict but got {res.status_code}: {res.text}"
        print("10. Duplicate Edge Rejection OK")

        positions = {new_t1["id"]: {"x": 150, "y": 200}, new_t2["id"]: {"x": 450, "y": 200}}
        res = client.put(f"/api/missions/{new_m['id']}/positions", json={"positions": positions}, headers=TEST_HEADERS)
        assert res.status_code == 200, f"Batch positions failed: {res.text}"
        print("11. Batch Positions OK:", res.json())

        res = client.delete(f"/api/missions/{new_m['id']}", headers=TEST_HEADERS)
        assert res.status_code == 204, f"Delete mission failed: {res.text}"
        print("12. Clean Up OK!")
        print("\nALL 12 BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_tests()
