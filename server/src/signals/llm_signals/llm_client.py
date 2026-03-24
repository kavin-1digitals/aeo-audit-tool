from langchain_openai import ChatOpenAI
from src.config import LLM_PROVIDERS, OPENAI_API_KEY


def get_llm_client(llm_provider: str):
    if llm_provider == "openai":
        return ChatOpenAI(
            model=LLM_PROVIDERS['openai'],
            temperature=0,
            api_key=OPENAI_API_KEY,
        )
    elif llm_provider == "anthropic":
        # TODO: Implement Anthropic LLM integration
        pass
    else:
        raise ValueError(f"Unsupported LLM provider: {llm_provider}")

    
