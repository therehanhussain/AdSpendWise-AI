import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Separator } from './components/ui/separator';
import { Upload, BarChart3, Target, TrendingUp, DollarSign, Users, Zap, FileText, Brain, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Form state
  const [formData, setFormData] = useState({
    campaign_name: '',
    platform: '',
    impressions: '',
    clicks: '',
    conversions: '',
    spend: '',
    revenue: '',
    target_audience: '',
    ad_copy: '',
    keywords: ''
  });

  useEffect(() => {
    fetchDashboardData();
    fetchCampaigns();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/summary`);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get(`${API}/campaigns`);
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const campaignData = {
        ...formData,
        impressions: parseInt(formData.impressions),
        clicks: parseInt(formData.clicks),
        conversions: parseInt(formData.conversions),
        spend: parseFloat(formData.spend),
        revenue: parseFloat(formData.revenue)
      };

      await axios.post(`${API}/campaigns`, campaignData);
      toast.success('Campaign created successfully!');
      
      // Reset form
      setFormData({
        campaign_name: '',
        platform: '',
        impressions: '',
        clicks: '',
        conversions: '',
        spend: '',
        revenue: '',
        target_audience: '',
        ad_copy: '',
        keywords: ''
      });
      
      fetchCampaigns();
      fetchDashboardData();
    } catch (error) {
      toast.error('Error creating campaign');
      console.error('Error:', error);
    }
    
    setLoading(false);
  };

  const analyzeCampaign = async (campaignId) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/campaigns/${campaignId}/analyze`);
      setAnalyses(prev => ({ ...prev, [campaignId]: response.data }));
      toast.success('Campaign analyzed successfully!');
    } catch (error) {
      toast.error('Error analyzing campaign');
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API}/campaigns/bulk-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Uploaded ${response.data.campaigns.length} campaigns successfully!`);
      setSelectedFile(null);
      fetchCampaigns();
      fetchDashboardData();
    } catch (error) {
      toast.error('Error uploading file');
      console.error('Error:', error);
    }
    
    setLoading(false);
  };

  const bulkAnalyze = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/campaigns/bulk-analyze`);
      toast.success(`Created ${response.data.analyses.length} new analyses!`);
      
      // Refresh analyses
      for (const campaign of campaigns) {
        try {
          const analysisResponse = await axios.get(`${API}/campaigns/${campaign.id}/analysis`);
          if (analysisResponse.data.length > 0) {
            setAnalyses(prev => ({ 
              ...prev, 
              [campaign.id]: analysisResponse.data[analysisResponse.data.length - 1] 
            }));
          }
        } catch (error) {
          console.error(`Error fetching analysis for campaign ${campaign.id}:`, error);
        }
      }
    } catch (error) {
      toast.error('Error performing bulk analysis');
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const calculateMetrics = (campaign) => {
    const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions * 100) : 0;
    const conversionRate = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks * 100) : 0;
    const cpa = campaign.conversions > 0 ? campaign.spend / campaign.conversions : campaign.spend;
    const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
    const roi = campaign.spend > 0 ? ((campaign.revenue - campaign.spend) / campaign.spend * 100) : 0;
    
    return { ctr, conversionRate, cpa, roas, roi };
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-yellow-500';  
    return 'text-red-500';
  };

  const getScoreBadgeVariant = (score) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  AdSpendWise
                </h1>
                <p className="text-sm text-gray-600">AI-Powered Campaign Optimizer</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
              <Zap className="w-4 h-4 mr-1" />
              AI Powered
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Campaigns</span>
            </TabsTrigger>
            <TabsTrigger value="add-campaign" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Add Campaign</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-upload" className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Bulk Upload</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-white to-blue-50/30 border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                  <Target className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">{dashboardData.total_campaigns || 0}</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-emerald-50/30 border-emerald-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-700">
                    ${(dashboardData.total_revenue || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-purple-50/30 border-purple-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700">
                    {(dashboardData.avg_roi || 0).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-amber-50/30 border-amber-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AI Analyses</CardTitle>
                  <Brain className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-700">{dashboardData.total_analyses || 0}</div>
                </CardContent>
              </Card>
            </div>

            {campaigns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="w-5 h-5 text-indigo-600" />
                    <span>AI-Powered Bulk Analysis</span>
                  </CardTitle>
                  <CardDescription>
                    Analyze all your campaigns with our advanced AI to get optimization insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={bulkAnalyze} 
                    disabled={loading}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    {loading ? 'Analyzing...' : 'Analyze All Campaigns'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            {campaigns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Target className="w-16 h-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
                  <p className="text-gray-600 mb-4">Get started by adding your first campaign or uploading a CSV file</p>
                  <div className="flex space-x-4">
                    <Button onClick={() => setActiveTab('add-campaign')}>Add Campaign</Button>
                    <Button variant="outline" onClick={() => setActiveTab('bulk-upload')}>
                      <Upload className="w-4 h-4 mr-2" />
                      Bulk Upload
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {campaigns.map((campaign) => {
                  const metrics = calculateMetrics(campaign);
                  const analysis = analyses[campaign.id];
                  
                  return (
                    <Card key={campaign.id} className="bg-gradient-to-r from-white to-gray-50/30">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center space-x-2">
                              <span>{campaign.campaign_name}</span>
                              <Badge variant="outline">{campaign.platform}</Badge>
                            </CardTitle>
                            <CardDescription>{campaign.target_audience}</CardDescription>
                          </div>
                          <div className="flex items-center space-x-2">
                            {analysis && (
                              <Badge 
                                variant={getScoreBadgeVariant(analysis.overall_score)}
                                className="text-white"
                              >
                                Score: {analysis.overall_score}/100
                              </Badge>
                            )}
                            <Button 
                              onClick={() => analyzeCampaign(campaign.id)}
                              disabled={loading}
                              size="sm"
                              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                            >
                              <Brain className="w-4 h-4 mr-1" />
                              {loading ? 'Analyzing...' : 'AI Analyze'}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">CTR</p>
                            <p className="text-lg font-semibold">{metrics.ctr.toFixed(2)}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Conv. Rate</p>
                            <p className="text-lg font-semibold">{metrics.conversionRate.toFixed(2)}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">CPA</p>
                            <p className="text-lg font-semibold">${metrics.cpa.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">ROAS</p>
                            <p className="text-lg font-semibold">{metrics.roas.toFixed(2)}x</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">ROI</p>
                            <p className={`text-lg font-semibold ${metrics.roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {metrics.roi.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        {/* AI Analysis Results */}
                        {analysis && (
                          <div className="mt-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                            <h4 className="font-semibold text-indigo-900 mb-3 flex items-center">
                              <Brain className="w-4 h-4 mr-2" />
                              AI Analysis & Recommendations
                            </h4>
                            
                            <div className="grid gap-4">
                              <div>
                                <h5 className="font-medium text-indigo-800 flex items-center mb-2">
                                  <BarChart3 className="w-4 h-4 mr-1" />
                                  Performance Analysis
                                </h5>
                                <p className="text-sm text-gray-700">{analysis.performance_analysis}</p>
                              </div>
                              
                              <div>
                                <h5 className="font-medium text-indigo-800 flex items-center mb-2">
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  Budget Recommendations
                                </h5>
                                <p className="text-sm text-gray-700">{analysis.budget_recommendations}</p>
                              </div>
                              
                              <div>
                                <h5 className="font-medium text-indigo-800 flex items-center mb-2">
                                  <Users className="w-4 h-4 mr-1" />
                                  Targeting Suggestions
                                </h5>
                                <p className="text-sm text-gray-700">{analysis.targeting_suggestions}</p>
                              </div>
                              
                              <div>
                                <h5 className="font-medium text-indigo-800 flex items-center mb-2">
                                  <FileText className="w-4 h-4 mr-1" />
                                  Copy Optimization
                                </h5>
                                <p className="text-sm text-gray-700">{analysis.copy_optimization}</p>
                              </div>
                              
                              <div>
                                <h5 className="font-medium text-indigo-800 flex items-center mb-2">
                                  <TrendingUp className="w-4 h-4 mr-1" />
                                  ROI Strategies
                                </h5>
                                <p className="text-sm text-gray-700">{analysis.roi_strategies}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Add Campaign Tab */}
          <TabsContent value="add-campaign">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>Add New Campaign</span>
                </CardTitle>
                <CardDescription>
                  Enter your campaign data to get AI-powered optimization insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="campaign_name">Campaign Name</Label>
                      <Input
                        id="campaign_name"
                        value={formData.campaign_name}
                        onChange={(e) => handleInputChange('campaign_name', e.target.value)}
                        placeholder="e.g., Summer Sale Campaign"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="platform">Platform</Label>
                      <Select value={formData.platform} onValueChange={(value) => handleInputChange('platform', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Google Ads">Google Ads</SelectItem>
                          <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                          <SelectItem value="Instagram Ads">Instagram Ads</SelectItem>
                          <SelectItem value="LinkedIn Ads">LinkedIn Ads</SelectItem>
                          <SelectItem value="Twitter Ads">Twitter Ads</SelectItem>
                          <SelectItem value="TikTok Ads">TikTok Ads</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="impressions">Impressions</Label>
                      <Input
                        id="impressions"
                        type="number"
                        value={formData.impressions}
                        onChange={(e) => handleInputChange('impressions', e.target.value)}
                        placeholder="e.g., 100000"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="clicks">Clicks</Label>
                      <Input
                        id="clicks"
                        type="number"
                        value={formData.clicks}
                        onChange={(e) => handleInputChange('clicks', e.target.value)}
                        placeholder="e.g., 5000"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="conversions">Conversions</Label>
                      <Input
                        id="conversions"
                        type="number"
                        value={formData.conversions}
                        onChange={(e) => handleInputChange('conversions', e.target.value)}
                        placeholder="e.g., 250"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="spend">Spend ($)</Label>
                      <Input
                        id="spend"
                        type="number"
                        step="0.01"
                        value={formData.spend}
                        onChange={(e) => handleInputChange('spend', e.target.value)}
                        placeholder="e.g., 5000.00"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="revenue">Revenue ($)</Label>
                      <Input
                        id="revenue"
                        type="number"
                        step="0.01"
                        value={formData.revenue}
                        onChange={(e) => handleInputChange('revenue', e.target.value)}
                        placeholder="e.g., 12500.00"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="keywords">Keywords (Optional)</Label>
                      <Input
                        id="keywords"
                        value={formData.keywords}
                        onChange={(e) => handleInputChange('keywords', e.target.value)}
                        placeholder="e.g., summer sale, discount, clothing"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="target_audience">Target Audience</Label>
                    <Input
                      id="target_audience"
                      value={formData.target_audience}
                      onChange={(e) => handleInputChange('target_audience', e.target.value)}
                      placeholder="e.g., Women 25-35, interested in fashion"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ad_copy">Ad Copy</Label>
                    <Textarea
                      id="ad_copy"
                      value={formData.ad_copy}
                      onChange={(e) => handleInputChange('ad_copy', e.target.value)}
                      placeholder="Enter your ad copy here..."
                      rows={4}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                  >
                    {loading ? 'Creating Campaign...' : 'Create Campaign'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Upload Tab */}
          <TabsContent value="bulk-upload">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span>Bulk Upload Campaigns</span>
                </CardTitle>
                <CardDescription>
                  Upload multiple campaigns from a CSV file for batch processing and AI analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="csv-file">Select CSV File</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="mt-2"
                    />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements:</h4>
                    <p className="text-sm text-blue-800 mb-2">Your CSV file should include these columns:</p>
                    <code className="text-xs bg-blue-100 px-2 py-1 rounded block">
                      campaign_name, platform, impressions, clicks, conversions, spend, revenue, target_audience, ad_copy, keywords (optional)
                    </code>
                  </div>
                  
                  <Button 
                    onClick={handleFileUpload}
                    disabled={!selectedFile || loading}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {loading ? 'Uploading...' : 'Upload Campaigns'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;