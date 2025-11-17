CREATE TABLE score_subject (
  subject_id INT,
  score_id INT,
  PRIMARY KEY (subject_id, score_id)
);

CREATE TABLE student (
  id INT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  score_id INT,
  subject_id INT,
  CONSTRAINT fk_student_score_subject_id
  FOREIGN KEY (subject_id, score_id) REFERENCES score_subject(subject_id, score_id)
);

ALTER TABLE student ADD FOREIGN KEY (subject_id, score_id) REFERENCES score_subject(subject_id, score_id);
