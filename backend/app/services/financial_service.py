"""Financial Service for Depreciation Schedules, TCO & Budget Forecasting"""

from datetime import datetime, date
from ..repositories.financial_repository import FinancialRepository
from ..repositories.asset_repository import AssetRepository

class FinancialService:
    """Business logic for asset financial lifecycles, depreciation models, and TCO evaluations"""

    @staticmethod
    def _generate_depreciation_schedule(cost, salvage_value, useful_life_years, method, purchase_date_str):
        """Generate year-by-year depreciation curve for an asset"""
        cost = float(cost or 0.0)
        salvage = float(salvage_value or 0.0)
        life = int(useful_life_years or 5)
        method = str(method or 'straight_line').lower()
        
        schedule = []
        current_book = cost
        accum_dep = 0.0
        
        start_year = datetime.now().year
        if purchase_date_str:
            try:
                start_year = datetime.strptime(str(purchase_date_str)[:10], '%Y-%m-%d').year
            except Exception:
                pass

        if method == 'straight_line' and cost > salvage and life > 0:
            annual_dep = round((cost - salvage) / life, 2)
            for y in range(1, life + 1):
                dep_amount = min(annual_dep, current_book - salvage)
                current_book = max(salvage, current_book - dep_amount)
                accum_dep = round(accum_dep + dep_amount, 2)
                schedule.append({
                    'year_index': y,
                    'calendar_year': start_year + y,
                    'depreciation_expense': dep_amount,
                    'accumulated_depreciation': accum_dep,
                    'ending_book_value': round(current_book, 2)
                })
        elif method == 'double_declining' and cost > salvage and life > 0:
            rate = 2.0 / life
            for y in range(1, life + 1):
                dep_amount = round(current_book * rate, 2)
                if current_book - dep_amount < salvage:
                    dep_amount = max(0.0, current_book - salvage)
                current_book = max(salvage, current_book - dep_amount)
                accum_dep = round(accum_dep + dep_amount, 2)
                schedule.append({
                    'year_index': y,
                    'calendar_year': start_year + y,
                    'depreciation_expense': dep_amount,
                    'accumulated_depreciation': accum_dep,
                    'ending_book_value': round(current_book, 2)
                })
        else:
            # None or zero cost
            for y in range(1, life + 1):
                schedule.append({
                    'year_index': y,
                    'calendar_year': start_year + y,
                    'depreciation_expense': 0.00,
                    'accumulated_depreciation': 0.00,
                    'ending_book_value': cost
                })
                
        return schedule

    @staticmethod
    def get_asset_financial_breakdown(asset_id):
        """Fetch detailed financials, depreciation schedule, and maintenance OpEx for an asset"""
        asset_res = AssetRepository.get_by_id(asset_id)
        if not asset_res.data:
            return None, "Asset not found", 404
            
        financials = FinancialRepository.get_asset_financials(asset_id)
        if not financials:
            # Fallback calculation if RPC returns empty
            raw_a = asset_res.data
            cost = float(raw_a.get('cost') or 0.0)
            salvage = float(raw_a.get('salvage_value') or 0.0)
            life = int(raw_a.get('useful_life_years') or 5)
            method = raw_a.get('depreciation_method') or 'straight_line'
            financials = {
                'asset_id': raw_a['id'],
                'asset_name': raw_a['name'],
                'asset_type': raw_a['type'],
                'purchase_cost': cost,
                'salvage_value': salvage,
                'useful_life_years': life,
                'depreciation_method': method,
                'purchase_date': raw_a.get('purchase_date'),
                'age_months': 0.0,
                'age_years': 0.00,
                'current_book_value': cost,
                'accumulated_depreciation': 0.00,
                'annual_depreciation': 0.00,
                'maintenance_cost_total': 0.00,
                'license_cost_total': 0.00,
                'total_cost_of_ownership': cost
            }

        # Fetch contributing maintenance incidents
        maint_incidents_res = FinancialRepository.get_asset_maintenance_incidents(asset_id)
        maint_incidents = maint_incidents_res.data or []

        # Generate 5-year depreciation schedule
        schedule = FinancialService._generate_depreciation_schedule(
            cost=financials.get('purchase_cost'),
            salvage_value=financials.get('salvage_value'),
            useful_life_years=financials.get('useful_life_years'),
            method=financials.get('depreciation_method'),
            purchase_date_str=financials.get('purchase_date')
        )

        # Evaluate TCO Health & Maintenance Burden
        purchase_cost = float(financials.get('purchase_cost') or 0.0)
        maint_cost = float(financials.get('maintenance_cost_total') or 0.0)
        
        health_verdict = 'HEALTHY'
        if purchase_cost > 0:
            if maint_cost >= (0.60 * purchase_cost):
                health_verdict = 'REPLACEMENT_RECOMMENDED'
            elif maint_cost >= (0.30 * purchase_cost):
                health_verdict = 'ELEVATED_MAINTENANCE'

        return {
            'financials': financials,
            'health_verdict': health_verdict,
            'maintenance_incidents': maint_incidents,
            'depreciation_schedule': schedule
        }, None, 200

    @staticmethod
    def get_executive_financial_overview():
        """Retrieve organization-wide financial KPIs and TCO metrics"""
        data = FinancialRepository.get_executive_summary()
        if not data:
            return {
                'overview': {
                    'total_assets_tracked': 0,
                    'total_capitalized_investment': 0.00,
                    'total_current_book_value': 0.00,
                    'total_accumulated_depreciation': 0.00,
                    'total_maintenance_expenditure': 0.00,
                    'total_software_licensing_spend': 0.00,
                    'total_infrastructure_tco': 0.00,
                    'overall_depreciation_percent': 0.00
                },
                'by_type': {}
            }, None, 200
        return data, None, 200

    @staticmethod
    def get_depreciation_forecast():
        """5-Year forward depreciation forecast across all capital assets"""
        res = FinancialRepository.get_all_active_assets()
        assets = res.data or []
        
        current_year = datetime.now().year
        forecast_by_year = {
            str(current_year + i): {
                'year': current_year + i,
                'projected_book_value': 0.00,
                'projected_depreciation_expense': 0.00
            }
            for i in range(1, 6)
        }

        for a in assets:
            cost = float(a.get('cost') or 0.0)
            salvage = float(a.get('salvage_value') or 0.0)
            life = int(a.get('useful_life_years') or 5)
            method = a.get('depreciation_method') or 'straight_line'
            pdate = a.get('purchase_date')
            
            sched = FinancialService._generate_depreciation_schedule(cost, salvage, life, method, pdate)
            for item in sched:
                yr_key = str(item['calendar_year'])
                if yr_key in forecast_by_year:
                    forecast_by_year[yr_key]['projected_book_value'] += item['ending_book_value']
                    forecast_by_year[yr_key]['projected_depreciation_expense'] += item['depreciation_expense']

        # Format sorted list
        forecast_list = [forecast_by_year[k] for k in sorted(forecast_by_year.keys())]
        return {'forecast': forecast_list}, None, 200
