-- Phase 4: seed profile_facts from Malama's actual resume
-- (Malama_Masheke_Resume_Printable (6).pdf, provided directly in
-- conversation). Every claim here is copied or straightforwardly
-- summarized from that document — nothing invented, per CLAUDE.md's
-- non-negotiable #4. Strength is graded conservatively: only claims backed
-- by a specific listed project/workshop are 'demonstrated'; resume-listed
-- skills with no dedicated project shown (row 14) are 'exposure', per the
-- user's own confirmation that self-reported-but-unlisted skills are still
-- real, just not independently backed by a project bullet.

insert into profile_facts (category, claim, evidence, strength, tags)
values
  (
    'education',
    'Pursuing B.S. in Computer Information Systems at Livingstone College, expected graduation December 2029, current GPA 4.0/4.0.',
    'Livingstone College enrollment record',
    'demonstrated',
    '{}'
  ),
  (
    'education',
    'Completed Harvard''s CS50 (Introduction to Computer Science).',
    'Harvard CS50 course completion',
    'coursework',
    '{cs50}'
  ),
  (
    'skill',
    'Completed a Udemy course on Python for Machine Learning and Deep Learning.',
    'Udemy course completion certificate',
    'coursework',
    '{python,machine-learning,deep-learning}'
  ),
  (
    'project',
    'Built and deployed Dēmos, a full-stack voting platform (Next.js, TypeScript, PostgreSQL, hosted on Vercel) supporting everything from simple polls to full ranked-choice elections with round-by-round elimination logic, built jointly with a collaborator who handled the frontend.',
    'https://demos-rust-eight.vercel.app',
    'demonstrated',
    '{nextjs,typescript,postgresql,vercel,fullstack}'
  ),
  (
    'skill',
    'Designed database-level access control and authorization for Dēmos so permission rules are enforced by the schema itself rather than the application, including API design, query design, and schema design; audited own design and closed a vote-traceability privacy gap.',
    'Dēmos project (https://demos-rust-eight.vercel.app)',
    'demonstrated',
    '{access-control,authorization,schema-design,relational-data-modeling,api-design,query-design}'
  ),
  (
    'project',
    'Built Tri-Ask-Me, a Python-based AI customer-support triage agent using Amazon Bedrock, retrieval-augmented generation, and TF-IDF, that classifies and routes support tickets and declines to answer when no relevant documentation is found; built in under 24 hours for a HackerRank hackathon and tested against real tickets from three products (Claude, Visa, and HackerRank).',
    'https://github.com/malgmash/Tri-Ask-Me',
    'demonstrated',
    '{python,llm,rag,amazon-bedrock,hackathon}'
  ),
  (
    'skill',
    'Selected as one of 40 undergraduates nationwide for an NSF-funded wireless communication and spectrum policy research workshop (Spectrum Sizzle, Baylor University SMART Hub); analyzed real signal measurements in MATLAB covering frequency allocation, radar systems, and spectrum policy.',
    'Spectrum Sizzle Workshop, Baylor University SMART Hub, June 2026',
    'demonstrated',
    '{matlab,signal-processing,data-analysis}'
  ),
  (
    'skill',
    'Proficient in Python, TypeScript/JavaScript, and SQL, applied in Tri-Ask-Me (Python) and Dēmos (TypeScript, SQL/PostgreSQL query and schema design).',
    'Tri-Ask-Me and Dēmos projects',
    'demonstrated',
    '{python,typescript,javascript,sql}'
  ),
  (
    'skill',
    'Comfortable with Git and GitHub for version control, used across all listed projects.',
    'https://github.com/malgmash',
    'demonstrated',
    '{git,github}'
  ),
  (
    'leadership',
    'Serves as Adobe Student Ambassador at Livingstone College: runs peer education sessions and live product demonstrations to grow adoption of Adobe''s creative tools among students, and iterates session content based on where students get stuck.',
    'Adobe Student Ambassador program, Livingstone College',
    'demonstrated',
    '{public-speaking,peer-education,community-building}'
  ),
  (
    'award',
    'Placed in the top 10% globally (out of 15,000+ participants) in the HackerRank Worldwide Hackathon for the Tri-Ask-Me project.',
    'https://github.com/malgmash/Tri-Ask-Me; HackerRank Worldwide Hackathon results',
    'demonstrated',
    '{hackathon}'
  ),
  (
    'award',
    'Awarded the Odessa J. Robinson Scholarship (Promise City Church).',
    'Promise City Church, Odessa J. Robinson Scholarship',
    'demonstrated',
    '{}'
  ),
  (
    'award',
    'Class Salutatorian, Overall Best in Mathematics, and Leadership Award recipient at Lwengu School, Monze, Zambia (Jan 2019 - Nov 2021).',
    'Lwengu School, Monze, Zambia',
    'demonstrated',
    '{}'
  ),
  (
    'skill',
    'Familiar with C, Codex, Claude Code, Bash, VS Code, Jupyter Notebook, Google Colab, and client-server architecture concepts, via coursework and self-directed use not tied to a specific listed project.',
    'self-reported on resume',
    'exposure',
    '{c,codex,claude-code,bash,vscode,jupyter,colab,client-server-architecture}'
  );
