CREATE TABLE IF NOT EXISTS schools ( 
  school_id INT PRIMARY KEY, 
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS professors ( 
  prof_id INT PRIMARY KEY, 
  name VARCHAR(100), 
  school_id INT,  
  department VARCHAR(255),
  num_ratings INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE 
); 

CREATE TABLE IF NOT EXISTS analysis_runs ( 
  id INT AUTO_INCREMENT PRIMARY KEY, 
  professor_id INT, 
  sentiment_score FLOAT, 
  rmp_rating FLOAT, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  FOREIGN KEY (professor_id) REFERENCES professors(prof_id) ON DELETE CASCADE 
);