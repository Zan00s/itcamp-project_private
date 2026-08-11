CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    scenario_id  TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    attempt      INT NOT NULL,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    started_at   TIMESTAMP NOT NULL,
    ended_at     TIMESTAMP,
    graph        JSONB NOT NULL,
    verdict      JSONB
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario ON sessions(scenario_id);

CREATE TABLE IF NOT EXISTS exam_assignments (
    id           TEXT PRIMARY KEY,
    scenario_id  TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    student_id   TEXT NOT NULL,
    assigned_by  TEXT NOT NULL,
    assigned_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_assignments_student ON exam_assignments(student_id);
