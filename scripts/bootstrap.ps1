Write-Host "Setting up Power BI Manager environment"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
npm install --prefix frontend
