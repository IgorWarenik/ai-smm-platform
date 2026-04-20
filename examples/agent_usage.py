# Agent Usage Examples

## Basic Agent Interaction

### Creating a Marketing Agent
```python
from crewai import Agent, Task, Crew
from langchain_anthropic import ChatAnthropic
from textwrap import dedent

# Initialize Claude LLM
claude_llm = ChatAnthropic(
    model="claude-3-5-sonnet-20241022",
    temperature=0.7,
    max_tokens=4000
)

# Create Marketing Strategist Agent
marketing_agent = Agent(
    role="Marketing Strategist",
    goal=dedent("""
        Develop comprehensive marketing strategies that drive business growth.
        Analyze target audiences, competitive landscapes, and create actionable plans.
    """),
    backstory=dedent("""
        You are a senior marketing strategist with 15+ years of experience in digital marketing.
        You've helped numerous startups and established companies achieve significant growth
        through data-driven marketing strategies. You excel at identifying market opportunities,
        understanding customer psychology, and creating compelling value propositions.
    """),
    llm=claude_llm,
    verbose=True,
    allow_delegation=False
)

print("Marketing Agent created successfully!")
```

### Creating a Content Creator Agent
```python
# Create Content Creator Agent
content_agent = Agent(
    role="Content Creator",
    goal=dedent("""
        Create engaging, high-quality content that resonates with target audiences
        and drives desired actions across multiple platforms.
    """),
    backstory=dedent("""
        You are a versatile content creator with expertise in digital marketing content.
        You've written thousands of pieces across blogs, social media, email campaigns,
        and video scripts. You understand SEO, copywriting psychology, and platform-specific
        content strategies. Your content consistently performs above industry benchmarks.
    """),
    llm=claude_llm,
    verbose=True,
    allow_delegation=False
)

print("Content Creator Agent created successfully!")
```

## Task Creation and Execution

### Simple Marketing Strategy Task
```python
from crewai import Task

# Define a marketing strategy task
strategy_task = Task(
    description=dedent("""
        Create a comprehensive marketing strategy for a new SaaS product called "TaskFlow" -
        a project management tool for remote teams.

        Target Audience: Small to medium businesses (50-500 employees) in tech industry
        Key Challenges: Team collaboration, project visibility, productivity tracking
        Budget: $50,000 for first 3 months
        Goals: 1000 qualified leads, 100 paying customers

        Provide:
        1. Executive Summary
        2. Target Audience Analysis
        3. Competitive Analysis
        4. Marketing Channels Strategy
        5. Content Marketing Plan
        6. Budget Allocation
        7. Success Metrics and KPIs
        8. Timeline and Milestones
    """),
    expected_output=dedent("""
        A detailed marketing strategy document with actionable recommendations,
        budget breakdown, and measurable success criteria.
    """),
    agent=marketing_agent
)

print("Strategy task created!")
```

### Content Creation Task
```python
# Define a content creation task
content_task = Task(
    description=dedent("""
        Based on the marketing strategy above, create content for a 30-day social media campaign.

        Requirements:
        - 30 Instagram posts (mix of carousels, reels, stories)
        - 15 LinkedIn articles (thought leadership)
        - 10 Twitter threads (educational content)
        - 5 blog posts (SEO-optimized)
        - 3 video scripts (YouTube/LinkedIn)

        Content should:
        - Address pain points of remote team management
        - Showcase TaskFlow's unique features
        - Include calls-to-action for lead generation
        - Use engaging visuals and storytelling
        - Maintain consistent brand voice
    """),
    expected_output=dedent("""
        Complete content calendar with all posts, articles, and scripts ready for publishing.
        Include recommended posting schedule, hashtags, and performance tracking suggestions.
    """),
    agent=content_agent
)

print("Content task created!")
```

## Crew Orchestration

### Sequential Execution (Scenario B)
```python
from crewai import Crew, Process

# Create crew with sequential process
marketing_crew = Crew(
    agents=[marketing_agent, content_agent],
    tasks=[strategy_task, content_task],
    process=Process.sequential,  # Strategy first, then content
    verbose=True
)

print("Crew created with sequential process")

# Execute the crew
result = marketing_crew.kickoff()

print("Crew execution completed!")
print("Final Result:")
print(result)
```

### Parallel Execution (Scenario A)
```python
# Create separate tasks for parallel execution
research_task = Task(
    description="Research competitive landscape for project management tools",
    agent=marketing_agent
)

content_task_parallel = Task(
    description="Create brand guidelines and visual identity",
    agent=content_agent
)

# Create crew with parallel process
parallel_crew = Crew(
    agents=[marketing_agent, content_agent],
    tasks=[research_task, content_task_parallel],
    process=Process.parallel,
    verbose=True
)

print("Parallel crew created")

# Execute in parallel
parallel_result = parallel_crew.kickoff()

print("Parallel execution completed!")
```

## Advanced Agent Features

### Agent with Custom Tools
```python
from crewai import tool
from typing import Dict, Any

# Define custom tools
@tool
def analyze_competitors(company_name: str) -> Dict[str, Any]:
    """
    Analyze competitors for a given company.

    Args:
        company_name: Name of the company to analyze

    Returns:
        Dictionary with competitor analysis
    """
    # Mock implementation - in real scenario, this would call APIs
    return {
        "company": company_name,
        "main_competitors": ["Asana", "Trello", "Monday.com"],
        "market_share": "5%",
        "strengths": ["User-friendly", "Fast deployment"],
        "weaknesses": ["Limited reporting", "Higher pricing"],
        "opportunities": ["AI integration", "Mobile experience"]
    }

@tool
def generate_content_ideas(topic: str, platform: str) -> Dict[str, Any]:
    """
    Generate content ideas for a specific topic and platform.

    Args:
        topic: Main topic for content
        platform: Target platform (instagram, linkedin, etc.)

    Returns:
        Dictionary with content ideas
    """
    # Mock implementation
    return {
        "topic": topic,
        "platform": platform,
        "ideas": [
            f"How {topic} transforms team productivity",
            f"5 {topic} best practices for 2024",
            f"Case study: {topic} success story",
            f"Common {topic} mistakes to avoid"
        ],
        "hashtags": ["#Productivity", "#TeamWork", "#ProjectManagement"],
        "best_posting_time": "Tuesday 10 AM"
    }

# Create agent with custom tools
advanced_marketing_agent = Agent(
    role="Senior Marketing Analyst",
    goal="Provide data-driven marketing insights and strategies",
    backstory="Experienced marketing analyst with deep industry knowledge",
    llm=claude_llm,
    tools=[analyze_competitors, generate_content_ideas],
    verbose=True
)

print("Advanced agent with custom tools created!")
```

### Conditional Task Execution
```python
from crewai import Task, Crew

# Define tasks with conditions
market_research = Task(
    description="Conduct market research for TaskFlow",
    agent=marketing_agent
)

competitor_analysis = Task(
    description="Analyze competitors in detail",
    agent=marketing_agent,
    context=[market_research]  # Depends on market research
)

strategy_development = Task(
    description="Develop marketing strategy based on research",
    agent=marketing_agent,
    context=[competitor_analysis]
)

# Conditional task - only execute if budget allows
content_creation = Task(
    description="Create content assets",
    agent=content_agent,
    context=[strategy_development]
)

# Create crew with conditional logic
conditional_crew = Crew(
    agents=[marketing_agent, content_agent],
    tasks=[market_research, competitor_analysis, strategy_development, content_creation],
    verbose=True
)

# Execute with conditional logic
result = conditional_crew.kickoff()
```

## Integration with FastAPI

### Agent Service Class
```python
from fastapi import HTTPException
from crewai import Crew, Process
import logging

logger = logging.getLogger(__name__)

class MarketingAgentService:
    """Service for managing marketing AI agents."""

    def __init__(self):
        self.marketing_agent = self._create_marketing_agent()
        self.content_agent = self._create_content_agent()

    def _create_marketing_agent(self) -> Agent:
        """Create and configure marketing agent."""
        return Agent(
            role="Marketing Strategist",
            goal="Develop effective marketing strategies",
            backstory="Experienced marketing professional",
            llm=claude_llm,
            verbose=False  # Less verbose for production
        )

    def _create_content_agent(self) -> Agent:
        """Create and configure content agent."""
        return Agent(
            role="Content Creator",
            goal="Create engaging marketing content",
            backstory="Skilled content creator",
            llm=claude_llm,
            verbose=False
        )

    async def execute_marketing_campaign(
        self,
        campaign_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a complete marketing campaign using AI agents.

        Args:
            campaign_data: Campaign configuration and requirements

        Returns:
            Campaign results and generated content
        """
        try:
            # Create strategy task
            strategy_task = Task(
                description=f"Create marketing strategy for: {campaign_data['product']}",
                expected_output="Comprehensive marketing strategy document",
                agent=self.marketing_agent
            )

            # Create content task
            content_task = Task(
                description=f"Generate content based on strategy for: {campaign_data['product']}",
                expected_output="Complete content package",
                agent=self.content_agent
            )

            # Create and execute crew
            crew = Crew(
                agents=[self.marketing_agent, self.content_agent],
                tasks=[strategy_task, content_task],
                process=Process.sequential
            )

            logger.info(f"Starting marketing campaign for {campaign_data['product']}")
            result = crew.kickoff()

            return {
                "status": "success",
                "campaign_id": f"camp_{hash(str(campaign_data))}",
                "results": str(result),
                "generated_at": "2024-01-15T10:30:00Z"
            }

        except Exception as e:
            logger.error(f"Campaign execution failed: {e}")
            raise HTTPException(
                status_code=500,
                detail="Campaign execution failed"
            )

# Usage in FastAPI
from fastapi import APIRouter, Depends
from .services import MarketingAgentService

router = APIRouter()
agent_service = MarketingAgentService()

@router.post("/campaigns")
async def create_campaign(
    campaign_data: Dict[str, Any],
    service: MarketingAgentService = Depends(lambda: agent_service)
):
    """Create and execute a marketing campaign."""
    return await service.execute_marketing_campaign(campaign_data)
```

## Error Handling and Logging

### Agent Error Handling
```python
import traceback
from crewai import Crew

class SafeCrewExecutor:
    """Safe crew execution with error handling."""

    @staticmethod
    def execute_with_error_handling(crew: Crew) -> Dict[str, Any]:
        """
        Execute crew with comprehensive error handling.

        Args:
            crew: CrewAI crew to execute

        Returns:
            Execution result or error details
        """
        try:
            logger.info("Starting crew execution")
            start_time = time.time()

            result = crew.kickoff()

            execution_time = time.time() - start_time
            logger.info(f"Crew execution completed in {execution_time:.2f}s")

            return {
                "status": "success",
                "result": str(result),
                "execution_time": execution_time
            }

        except Exception as e:
            logger.error(f"Crew execution failed: {e}")
            logger.error(traceback.format_exc())

            return {
                "status": "error",
                "error": str(e),
                "traceback": traceback.format_exc()
            }

# Usage
executor = SafeCrewExecutor()
result = executor.execute_with_error_handling(marketing_crew)

if result["status"] == "success":
    print("Campaign completed successfully!")
    print(result["result"])
else:
    print(f"Campaign failed: {result['error']}")
```

## Performance Optimization

### Agent Caching
```python
from functools import lru_cache
import hashlib

class CachedAgentService:
    """Agent service with result caching."""

    def __init__(self):
        self.cache = {}

    @lru_cache(maxsize=100)
    def _get_cache_key(self, task_description: str, agent_role: str) -> str:
        """Generate cache key for task results."""
        content = f"{task_description}_{agent_role}"
        return hashlib.md5(content.encode()).hexdigest()

    def execute_cached_task(
        self,
        agent: Agent,
        task_description: str,
        use_cache: bool = True
    ) -> str:
        """
        Execute agent task with optional caching.

        Args:
            agent: CrewAI agent
            task_description: Task description
            use_cache: Whether to use cached results

        Returns:
            Task result
        """
        cache_key = self._get_cache_key(task_description, agent.role)

        if use_cache and cache_key in self.cache:
            logger.info(f"Using cached result for {cache_key}")
            return self.cache[cache_key]

        # Execute task
        task = Task(description=task_description, agent=agent)
        crew = Crew(agents=[agent], tasks=[task], verbose=False)
        result = str(crew.kickoff())

        # Cache result
        self.cache[cache_key] = result
        logger.info(f"Cached result for {cache_key}")

        return result

# Usage
cached_service = CachedAgentService()
result = cached_service.execute_cached_task(
    marketing_agent,
    "Analyze target audience for SaaS product"
)
```

## Testing Agent Behavior

### Mock Agent for Testing
```python
from unittest.mock import Mock, patch

def test_agent_execution():
    """Test agent execution with mocked LLM."""
    with patch('langchain_anthropic.ChatAnthropic') as mock_llm:
        # Configure mock
        mock_instance = Mock()
        mock_instance.invoke.return_value = Mock(
            content="Mocked marketing strategy response"
        )
        mock_llm.return_value = mock_instance

        # Create agent with mock
        agent = Agent(
            role="Marketing Strategist",
            goal="Create strategies",
            llm=mock_llm.return_value
        )

        # Execute task
        task = Task(description="Create strategy", agent=agent)
        crew = Crew(agents=[agent], tasks=[task])

        result = crew.kickoff()

        # Assertions
        assert "Mocked marketing strategy" in str(result)
        mock_instance.invoke.assert_called_once()

print("Agent testing example completed!")
```