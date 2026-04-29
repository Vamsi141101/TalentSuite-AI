from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROLE_PROFILES = {
    "Senior Full-Stack Engineer": "React TypeScript JavaScript Next.js Node.js Express REST API GraphQL PostgreSQL MongoDB Redis Docker AWS system design architecture leadership mentoring code review agile cross-functional full-stack frontend backend API microservices CI/CD Python FastAPI",
    "ML / AI Engineer": "machine learning deep learning PyTorch TensorFlow scikit-learn LLMs BERT GPT LangChain OpenAI API Hugging Face spaCy NLP Python FastAPI vector database Pinecone embeddings fine-tuning model training inference data pipeline AI MLOps neural networks",
    "Backend Engineer": "Python Go Java Node.js FastAPI Flask Django REST API GraphQL PostgreSQL MySQL MongoDB Redis Kafka RabbitMQ microservices Docker Kubernetes AWS GCP cloud architecture database SQL system design performance scalability",
    "Frontend Engineer": "React Vue Angular TypeScript JavaScript HTML CSS Next.js Tailwind UI UX Figma Storybook accessibility responsive performance optimization webpack Vite state management Redux animations component library",
    "DevOps / Platform Engineer": "Kubernetes Docker Terraform AWS GCP Azure CI/CD GitHub Actions Jenkins infrastructure monitoring Datadog Prometheus Grafana Linux bash networking security cloud platform reliability SRE observability",
    "Data Scientist": "Python R Pandas NumPy scikit-learn TensorFlow PyTorch statistics machine learning data analysis visualization Jupyter Matplotlib Spark SQL A/B testing experimentation feature engineering model evaluation",
    "Data Engineer": "Python Spark Kafka Airflow dbt Hadoop AWS GCP BigQuery PostgreSQL Redshift Snowflake ETL pipeline data warehouse SQL data modeling orchestration batch streaming",
    "Product Manager": "product roadmap stakeholder management agile scrum prioritization user research market analysis KPIs metrics OKRs go-to-market product strategy wireframes Figma cross-functional leadership",
}

_vectorizer = None
_role_names = None
_role_matrix = None


def _build_model():
    global _vectorizer, _role_names, _role_matrix
    if _vectorizer:
        return
    _vectorizer = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), stop_words="english")
    _role_names = list(ROLE_PROFILES.keys())
    _role_matrix = _vectorizer.fit_transform(list(ROLE_PROFILES.values()))


def predict_roles(text: str, skills: dict) -> list:
    _build_model()
    skill_text = " ".join(skills.get("technical", []) + skills.get("tools", []) + skills.get("soft", []))
    combined = f"{text} {skill_text} {skill_text}"
    resume_vec = _vectorizer.transform([combined])
    similarities = cosine_similarity(resume_vec, _role_matrix).flatten()
    results = [{"role": name, "score": float(score)} for name, score in zip(_role_names, similarities)]
    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[0]["score"] if results[0]["score"] > 0 else 1
    for r in results:
        r["score"] = round(min(97.0, (r["score"] / top) * 95), 1)
    return results
