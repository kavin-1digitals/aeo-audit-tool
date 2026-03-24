import logging
import json
from src.signals import find_signals
from src.scorecard import create_aeo_scorecard
from src.main import create_audit_result

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import asyncio
    
    async def main():
        """Test the AEO audit scoring system"""
        # Get all signals using utils
        signals = await find_signals("https://www.express.com")
        
        # Generate AEO scorecard
        scorecard = await create_aeo_scorecard(signals)
        
        # Create audit result using scorecard logic
        audit_result = create_audit_result(signals, scorecard)
        
        # Print results
        print("=" * 80)
        print("AEO AUDIT RESULTS")
        print("=" * 80)
        print(f"Domain: {audit_result['audit_metadata']['domain']}")
        print(f"Total Checks: {audit_result['audit_metadata']['total_checks']}")
        print(f"Total Score: {audit_result['audit_metadata']['total_score']}")
        print(f"Score Percentage: {audit_result['audit_metadata']['score_percentage']:.2f}%")
        
        print("\n" + "=" * 40)
        print("SCORES BY SIGNAL PATH")
        print("=" * 40)
        for path_key, group in scorecard.path_scorecard.items():
            print(f"\n{path_key}:")
            print(f"  Checks: {group['total_checks']}")
            print(f"  Raw Score: {group['total_score']:.1f}")
            print(f"  Positive Score: {group['total_positive_score']:.1f}")
            print(f"  Percentage: {group['total_percentage']:.2f}%")
            
            # Show individual scores in this group
            for score in group['scores']:
                status = "✓" if score.value > 0 else "✗" if score.value < 0 else "○"
                print(f"    {status} {score.signal_name}: {score.value}")
                if score.remediation_plan:
                    print(f"      → {score.remediation_plan}")
        
        print("\n" + "=" * 40)
        print("ALL DETAILED SCORES")
        print("=" * 40)
        for score in scorecard.raw_scorecard.scores:
            print(f"  - {score.signal_name}: {score.value}")
            if score.remediation_plan:
                print(f"    Remediation: {score.remediation_plan}")
            if score.success_state:
                print(f"    Success: {score.success_state}")
        
        # Save to file
        with open('audit_results.json', 'w') as f:
            json.dump(audit_result, f, indent=2, default=str)
        
        print(f"\nFull results saved to: audit_results.json")
    
    # Run the async main function
    asyncio.run(main())
