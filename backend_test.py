import requests
import sys
import json
import time
from datetime import datetime

class AdSpendWiseAPITester:
    def __init__(self, base_url="https://campaign-genius-7.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_campaigns = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else f"{self.api_url}/"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'id' in response_data:
                        print(f"   Response ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_create_campaign(self, campaign_data):
        """Test campaign creation"""
        success, response = self.run_test(
            f"Create Campaign: {campaign_data['campaign_name']}",
            "POST",
            "campaigns",
            200,
            data=campaign_data
        )
        if success and 'id' in response:
            self.created_campaigns.append(response['id'])
            return response['id']
        return None

    def test_get_campaigns(self):
        """Test getting all campaigns"""
        success, response = self.run_test(
            "Get All Campaigns",
            "GET",
            "campaigns",
            200
        )
        if success:
            print(f"   Found {len(response)} campaigns")
        return success, response

    def test_get_campaign(self, campaign_id):
        """Test getting specific campaign"""
        success, response = self.run_test(
            f"Get Campaign {campaign_id}",
            "GET",
            f"campaigns/{campaign_id}",
            200
        )
        return success, response

    def test_analyze_campaign(self, campaign_id):
        """Test AI campaign analysis"""
        print(f"   Starting AI analysis for campaign {campaign_id}...")
        success, response = self.run_test(
            f"AI Analyze Campaign {campaign_id}",
            "POST",
            f"campaigns/{campaign_id}/analyze",
            200
        )
        if success:
            print(f"   AI Score: {response.get('overall_score', 'N/A')}/100")
            print(f"   Performance Analysis: {response.get('performance_analysis', 'N/A')[:100]}...")
        return success, response

    def test_get_campaign_analysis(self, campaign_id):
        """Test getting campaign analysis"""
        success, response = self.run_test(
            f"Get Campaign Analysis {campaign_id}",
            "GET",
            f"campaigns/{campaign_id}/analysis",
            200
        )
        return success, response

    def test_bulk_analyze(self):
        """Test bulk analysis of all campaigns"""
        success, response = self.run_test(
            "Bulk Analyze All Campaigns",
            "POST",
            "campaigns/bulk-analyze",
            200
        )
        if success:
            print(f"   Created {len(response.get('analyses', []))} new analyses")
        return success, response

    def test_dashboard_summary(self):
        """Test dashboard summary"""
        success, response = self.run_test(
            "Dashboard Summary",
            "GET",
            "dashboard/summary",
            200
        )
        if success:
            print(f"   Total Campaigns: {response.get('total_campaigns', 0)}")
            print(f"   Total Revenue: ${response.get('total_revenue', 0):,.2f}")
            print(f"   Average ROI: {response.get('avg_roi', 0):.1f}%")
            print(f"   Total Analyses: {response.get('total_analyses', 0)}")
        return success, response

    def test_bulk_upload_csv(self):
        """Test CSV bulk upload"""
        # Create a test CSV content
        csv_content = """campaign_name,platform,impressions,clicks,conversions,spend,revenue,target_audience,ad_copy,keywords
Summer Sale Campaign,Google Ads,100000,5000,250,5000.00,12500.00,"Women 25-35 interested in fashion","Get 50% off summer collection - Limited time!","summer sale, discount, clothing"
Black Friday Deal,Facebook Ads,75000,3750,300,3000.00,15000.00,"Men and women 18-45 bargain hunters","Black Friday Sale - Up to 70% off everything!","black friday, sale, deals"
"""
        
        # Create a temporary file-like object
        files = {'file': ('test_campaigns.csv', csv_content, 'text/csv')}
        
        success, response = self.run_test(
            "Bulk Upload CSV",
            "POST",
            "campaigns/bulk-upload",
            200,
            files=files
        )
        if success:
            campaigns = response.get('campaigns', [])
            print(f"   Uploaded {len(campaigns)} campaigns")
            for campaign in campaigns:
                self.created_campaigns.append(campaign['id'])
        return success, response

def main():
    print("🚀 Starting AdSpendWise API Testing...")
    print("=" * 60)
    
    # Setup
    tester = AdSpendWiseAPITester()
    
    # Test 1: Health Check
    if not tester.test_health_check():
        print("❌ API health check failed, stopping tests")
        return 1

    # Test 2: Dashboard Summary (initial state)
    tester.test_dashboard_summary()

    # Test 3: Get campaigns (should be empty initially or show existing)
    tester.test_get_campaigns()

    # Test 4: Create sample campaigns
    sample_campaigns = [
        {
            "campaign_name": "Summer Sale Campaign",
            "platform": "Google Ads",
            "impressions": 100000,
            "clicks": 5000,
            "conversions": 250,
            "spend": 5000.00,
            "revenue": 12500.00,
            "target_audience": "Women 25-35 interested in fashion",
            "ad_copy": "Get 50% off summer collection - Limited time!",
            "keywords": "summer sale, discount, clothing"
        },
        {
            "campaign_name": "Black Friday Deal",
            "platform": "Facebook Ads",
            "impressions": 75000,
            "clicks": 3750,
            "conversions": 300,
            "spend": 3000.00,
            "revenue": 15000.00,
            "target_audience": "Men and women 18-45 bargain hunters",
            "ad_copy": "Black Friday Sale - Up to 70% off everything!",
            "keywords": "black friday, sale, deals"
        }
    ]

    created_campaign_ids = []
    for campaign in sample_campaigns:
        campaign_id = tester.test_create_campaign(campaign)
        if campaign_id:
            created_campaign_ids.append(campaign_id)

    # Test 5: Get specific campaigns
    for campaign_id in created_campaign_ids:
        tester.test_get_campaign(campaign_id)

    # Test 6: Get all campaigns (should now show created ones)
    tester.test_get_campaigns()

    # Test 7: AI Analysis (test one campaign first)
    if created_campaign_ids:
        print(f"\n🧠 Testing AI Analysis (this may take a few seconds)...")
        tester.test_analyze_campaign(created_campaign_ids[0])
        
        # Wait a moment for analysis to be saved
        time.sleep(2)
        
        # Test getting the analysis
        tester.test_get_campaign_analysis(created_campaign_ids[0])

    # Test 8: Bulk CSV Upload
    tester.test_bulk_upload_csv()

    # Test 9: Bulk Analysis
    if tester.created_campaigns:
        print(f"\n🔄 Testing Bulk Analysis...")
        tester.test_bulk_analyze()

    # Test 10: Final dashboard summary
    print(f"\n📊 Final Dashboard State:")
    tester.test_dashboard_summary()

    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL TEST RESULTS:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    print(f"   Created Campaigns: {len(tester.created_campaigns)}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed. Check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())