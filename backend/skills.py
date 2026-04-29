import re

SKILLS_TAXONOMY = {
    "technical": [
        "React", "Next.js", "Vue", "Angular", "TypeScript", "JavaScript", "HTML", "CSS",
        "Python", "FastAPI", "Flask", "Django", "Node.js", "Express", "GraphQL", "REST API",
        "Go", "Rust", "Java", "C++", "C#", "Ruby", "Rails", "PHP", "Swift", "Kotlin",
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Cassandra", "DynamoDB", "SQLite", "SQL",
        "Docker", "Kubernetes", "Terraform", "AWS", "GCP", "Azure", "Serverless", "Lambda",
        "PyTorch", "TensorFlow", "scikit-learn", "Keras", "BERT", "GPT", "LLMs",
        "LangChain", "LlamaIndex", "OpenAI API", "Hugging Face", "spaCy", "NLTK",
        "Pinecone", "Weaviate", "Qdrant", "Chroma", "Vector DB",
        "Spark", "Kafka", "Airflow", "dbt", "Pandas", "NumPy", "Matplotlib",
        "Elasticsearch", "RabbitMQ", "gRPC", "WebSockets", "Microservices",
        "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "MLOps",
        "React Native", "Flutter", "Tailwind", "Redux", "Prisma", "Supabase", "Firebase",
    ],
    "tools": [
        "Git", "GitHub", "GitLab", "Bitbucket",
        "CI/CD", "GitHub Actions", "Jenkins", "CircleCI",
        "Jira", "Linear", "Notion", "Confluence", "Asana",
        "Figma", "Storybook", "Postman", "Swagger",
        "VS Code", "IntelliJ", "Jupyter", "Colab",
        "Datadog", "Prometheus", "Grafana", "Sentry",
        "Vercel", "Netlify", "Heroku", "Railway",
    ],
    "soft": [
        "leadership", "mentoring", "coaching", "management",
        "system design", "architecture", "technical roadmap",
        "cross-functional", "collaboration", "stakeholder management",
        "agile", "scrum", "kanban", "sprint",
        "communication", "problem solving", "critical thinking",
        "code review", "pair programming", "technical writing",
        "project management", "prioritization", "decision making",
    ],
}


def extract_skills(text: str) -> dict:
    found = {"technical": set(), "tools": set(), "soft": set()}
    text_lower = text.lower()
    for category, skills in SKILLS_TAXONOMY.items():
        for skill in skills:
            pattern = r'\b' + re.escape(skill.lower()) + r'\b'
            if re.search(pattern, text_lower):
                found[category].add(skill)
    return {k: sorted(list(v)) for k, v in found.items()}
