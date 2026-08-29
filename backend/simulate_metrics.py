"""
Asset Metrics Simulator
-----------------------
This script connects to Supabase and simulates real-time metrics for all assets.
It updates metrics every 10 seconds with realistic random values.
Probability of critical issues: 15%

Requirements:
- supabase-py
- python-dotenv

Run: python simulate_metrics.py
"""

import os
import time
import random
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
# Use SERVICE_KEY to bypass RLS policies for system operations
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Threshold values
THRESHOLDS = {
    'hardware': {
        'cpu_critical': 90,
        'cpu_warning': 75,
        'memory_critical': 90,
        'memory_warning': 75,
        'disk_warning': 80,
        'temp_critical': 75,
        'temp_warning': 65,
    },
    'network': {
        'packet_loss_critical': 5,
        'packet_loss_warning': 2,
        'latency_warning': 100,
    },
    'infrastructure': {
        'response_time_warning': 500,
        'error_rate_warning': 1,
        'availability_critical': 99.0,
    }
}

# 15% chance of critical issues
FAILURE_PROBABILITY = 0.25

def generate_peripherals_metrics():
    """Generate metrics for peripheral assets (printers, monitors, keyboards, etc.)"""
    # 20% chance of peripheral failure
    is_critical = random.random() < 0.20
    
    # Connection status
    connection_statuses = ['connected', 'disconnected', 'intermittent']
    if is_critical:
        connection_status = random.choice(['disconnected', 'intermittent'])
    else:
        connection_status = 'connected'
    
    # Print status (for printers)
    print_statuses = ['online', 'offline', 'paper_jam', 'low_toner', 'error']
    if is_critical:
        print_status = random.choice(['offline', 'error', 'paper_jam'])
    else:
        print_status = random.choice(['online', 'low_toner']) if random.random() > 0.8 else 'online'
    
    # Peripheral errors
    peripheral_errors = [
        "Device not responding",
        "Driver error",
        "Connection timeout",
        "Hardware malfunction",
        "Paper jam detected",
        "Low toner warning",
        "Communication error",
        "Device offline",
    ]
    
    # Calculate health_status
    if connection_status == 'disconnected' or print_status in ['offline', 'error', 'paper_jam']:
        health_status = 'critical'
    elif connection_status == 'intermittent' or print_status == 'low_toner':
        health_status = 'warning'
    else:
        health_status = 'healthy'
    
    return {
        'connection_status': connection_status,
        'print_status': print_status,
        'usage_hours': round(random.uniform(0, 5000), 2),
        'peripheral_error': random.choice(peripheral_errors) if is_critical else None,
        'health_status': health_status,
    }

def generate_hardware_metrics():
    """Generate metrics for hardware assets"""
    # 15% chance of critical metrics
    is_critical = random.random() < FAILURE_PROBABILITY
    
    if is_critical:
        # Critical range: 90-98% to ensure we exceed thresholds
        cpu_usage = random.uniform(90, 98)
        memory_usage = random.uniform(90, 98)
        disk_usage = random.uniform(82, 95)
        temperature = random.uniform(76, 85)  # Above 75°C threshold
    else:
        # Normal operation: 20-75%
        cpu_usage = random.uniform(20, 75)
        memory_usage = random.uniform(30, 75)
        disk_usage = random.uniform(40, 75)
        temperature = random.uniform(40, 65)
    
    # Calculate health_status based on thresholds
    if cpu_usage > 90 or memory_usage > 90 or temperature > 75 or disk_usage > 80:
        health_status = 'critical'
    elif cpu_usage > 75 or memory_usage > 75 or temperature > 65 or disk_usage > 70:
        health_status = 'warning'
    else:
        health_status = 'healthy'
    
    return {
        'cpu_usage': round(cpu_usage, 2),
        'memory_usage': round(memory_usage, 2),
        'disk_usage': round(disk_usage, 2),
        'temperature': round(temperature, 2),
        'health_status': health_status,
    }

def generate_software_metrics():
    """Generate metrics for software assets"""
    # 5% chance software is not operational
    is_operational = random.random() > FAILURE_PROBABILITY
    
    errors = [
        "Connection timeout",
        "Database connection failed",
        "Authentication error",
        "Memory allocation failed",
        "Service unavailable",
        "Configuration error",
    ]
    
    return {
        'is_operational': is_operational,
        'last_error': None if is_operational else random.choice(errors),
        'uptime_hours': round(random.uniform(0, 720), 2) if is_operational else 0,
        'health_status': 'healthy' if is_operational else 'critical',
    }

def generate_network_metrics():
    """Generate metrics for network assets"""
    # 5% chance of high packet loss
    is_critical = random.random() < FAILURE_PROBABILITY
    
    if is_critical:
        packet_loss = random.uniform(5, 15)
        latency = random.uniform(100, 500)
    else:
        packet_loss = random.uniform(0, 1.5)
        latency = random.uniform(5, 50)
    
    # Calculate health_status
    if packet_loss > 5 or latency > 100:
        health_status = 'critical'
    elif packet_loss > 2 or latency > 50:
        health_status = 'warning'
    else:
        health_status = 'healthy'
    
    return {
        'bandwidth_usage_mbps': round(random.uniform(100, 900), 2),
        'packet_loss_percent': round(packet_loss, 2),
        'latency_ms': round(latency, 2),
        'active_connections': random.randint(10, 100),
        'health_status': health_status,
    }

def generate_infrastructure_metrics():
    """Generate metrics for infrastructure assets"""
    # 5% chance service is down or degraded
    rand_val = random.random()
    
    if rand_val < FAILURE_PROBABILITY:
        service_status = 'down'
        response_time = random.uniform(1000, 5000)
        error_rate = random.uniform(10, 50)
        availability = random.uniform(50, 95)
        health_status = 'critical'
    elif rand_val < FAILURE_PROBABILITY * 2:
        service_status = 'degraded'
        response_time = random.uniform(300, 1000)
        error_rate = random.uniform(1, 5)
        availability = random.uniform(95, 99)
        health_status = 'warning'
    else:
        service_status = 'healthy'
        response_time = random.uniform(50, 300)
        error_rate = random.uniform(0, 0.5)
        availability = random.uniform(99.5, 100)
        health_status = 'healthy'
    
    return {
        'service_status': service_status,
        'response_time_ms': round(response_time, 2),
        'error_rate_percent': round(error_rate, 2),
        'availability_percent': round(availability, 2),
        'health_status': health_status,
    }

def get_all_assets():
    """Fetch all assets from database"""
    try:
        response = supabase.table('assets').select('id, name, type').execute()
        return response.data
    except Exception as e:
        print(f"Error fetching assets: {e}")
        return []

def upsert_metrics(asset_id, asset_type, metrics):
    """Insert or update metrics for an asset"""
    try:
        # Check if metrics exist
        existing = supabase.table('asset_metrics').select('id').eq('asset_id', asset_id).execute()
        
        metrics_data = {
            'asset_id': asset_id,
            **metrics
        }
        
        if existing.data and len(existing.data) > 0:
            # Update existing metrics
            result = supabase.table('asset_metrics').update(metrics_data).eq('asset_id', asset_id).execute()
        else:
            # Insert new metrics
            result = supabase.table('asset_metrics').insert(metrics_data).execute()
        
        return True
    except Exception as e:
        print(f"Error upserting metrics for asset {asset_id}: {e}")
        return False

def simulate_cycle():
    """Run one simulation cycle for all assets"""
    assets = get_all_assets()
    
    if not assets:
        print("No assets found in database")
        return
    
    print(f"\n{'='*60}")
    print(f"Simulation cycle at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    critical_count = 0
    warning_count = 0
    healthy_count = 0
    
    for asset in assets:
        asset_id = asset['id']
        asset_name = asset['name']
        asset_type = asset['type']
        
        # Generate metrics based on asset type - DYNAMIC!
        if asset_type == 'hardware':
            metrics = generate_hardware_metrics()
        elif asset_type == 'software':
            metrics = generate_software_metrics()
        elif asset_type == 'network':
            metrics = generate_network_metrics()
        elif asset_type == 'infrastructure':
            metrics = generate_infrastructure_metrics()
        elif asset_type == 'peripherals':
            metrics = generate_peripherals_metrics()
        else:
            # Unknown types get basic healthy status
            metrics = {'health_status': 'healthy'}
        
        # Update metrics in database
        success = upsert_metrics(asset_id, asset_type, metrics)
        
        if success:
            # Determine health status for logging
            health_icon = "✓"
            details = ""
            is_critical = False
            is_warning = False
            
            if asset_type == 'hardware':
                cpu = metrics['cpu_usage']
                mem = metrics['memory_usage']
                temp = metrics['temperature']
                
                if cpu > 90 or mem > 90 or temp > 75:
                    health_icon = "❌"
                    details = f" | 🔥 CPU:{cpu:.1f}% MEM:{mem:.1f}% TEMP:{temp:.1f}°C"
                    is_critical = True
                elif cpu > 75 or mem > 75 or temp > 65:
                    health_icon = "⚠"
                    details = f" | ⚠️ CPU:{cpu:.1f}% MEM:{mem:.1f}%"
                    is_warning = True
                    
            elif asset_type == 'software':
                health_icon = "✓" if metrics['is_operational'] else "❌"
                if not metrics['is_operational']:
                    details = f" | Error: {metrics.get('last_error', 'Unknown')}"
                    is_critical = True
                    
            elif asset_type == 'network':
                loss = metrics['packet_loss_percent']
                if loss > 5:
                    health_icon = "❌"
                    details = f" | 📡 Packet Loss:{loss:.2f}%"
                    is_critical = True
                elif loss > 2:
                    health_icon = "⚠"
                    details = f" | ⚠️ Packet Loss:{loss:.2f}%"
                    is_warning = True
                    
            elif asset_type == 'infrastructure':
                status = metrics['service_status']
                if status == 'down':
                    health_icon = "❌"
                    details = f" | 🔴 Service DOWN"
                    is_critical = True
                elif status == 'degraded':
                    health_icon = "⚠"
                    details = f" | 🟡 Service DEGRADED"
                    is_warning = True
                    
            elif asset_type == 'peripherals':
                conn = metrics['connection_status']
                print_st = metrics.get('print_status', 'N/A')
                
                if conn == 'disconnected' or print_st in ['offline', 'error', 'paper_jam']:
                    health_icon = "❌"
                    details = f" | 🖨️ {conn.upper()}"
                    if print_st != 'N/A' and print_st != 'online':
                        details += f" - {print_st.replace('_', ' ').upper()}"
                    is_critical = True
                elif conn == 'intermittent' or print_st == 'low_toner':
                    health_icon = "⚠"
                    details = f" | ⚠️ {conn}"
                    if print_st == 'low_toner':
                        details += " - Low Toner"
                    is_warning = True
            
            # Count health statuses
            if is_critical:
                critical_count += 1
            elif is_warning:
                warning_count += 1
            else:
                healthy_count += 1
            
            print(f"{health_icon} {asset_name:30} [{asset_type:15}] - Updated{details}")
        else:
            print(f"✗ {asset_name:30} [{asset_type:15}] - Failed")
    
    # Print summary
    print(f"\n{'─'*60}")
    print(f"📊 Summary: {critical_count} Critical | {warning_count} Warning | {healthy_count} Healthy")
    if critical_count > 0:
        print(f"⚠️  {critical_count} asset(s) need immediate attention!")
    print(f"{'─'*60}")

def main():
    """Main simulation loop"""
    print("="*60)
    print("ASSET METRICS SIMULATOR")
    print("="*60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Update Interval: 10 seconds")
    print(f"Failure Probability: {FAILURE_PROBABILITY*100}%")
    print("="*60)
    print("\nPress Ctrl+C to stop\n")
    
    try:
        while True:
            simulate_cycle()
            print(f"\nWaiting 10 seconds before next cycle...")
            time.sleep(10)
    except KeyboardInterrupt:
        print("\n\n" + "="*60)
        print("Simulation stopped by user")
        print("="*60)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        print("="*60)

if __name__ == "__main__":
    main()
