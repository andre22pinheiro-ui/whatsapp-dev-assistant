"""
AgentX-ML: Autonomous Machine Learning Agent Engine
Combines Auto-GPT (Tool-driven Execution) + BabyAGI (Dynamic Task Creation & Prioritization)
applied to end-to-end Data Science & Machine Learning pipelines.
Adheres strictly to ml-best-practices: narrative data storytelling, rigorous splits,
model comparisons, hyperparameter tuning, and comprehensive metric evaluation.
"""

import os
import sys
import json
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AgentX-ML")


@dataclass
class MLTask:
    id: str
    name: str
    stage: str  # 'eda', 'preprocessing', 'model_selection', 'evaluation', 'reporting'
    description: str
    status: str = "pending"  # 'pending', 'executing', 'completed', 'failed'
    priority: int = 1
    result: Optional[Dict[str, Any]] = None


class TaskCreationChain:
    """Decomposes an ML objective into an ordered sequence of lifecycle tasks."""

    @staticmethod
    def create_initial_tasks(objective: str, problem_type: str) -> List[MLTask]:
        tasks = [
            MLTask(
                id="task_01",
                name="Exploratory Data Analysis & Schema Understanding",
                stage="eda",
                description="Inspect dataset schema, check missing values, visualize feature distributions and detect outliers.",
                priority=10
            ),
            MLTask(
                id="task_02",
                name="Data Cleaning, Encoding & Feature Scaling",
                stage="preprocessing",
                description="Convert dates into timestamps, apply OrdinalEncoder to ordinal features, OneHotEncoder to nominal, and standardize numerical features.",
                priority=20
            ),
            MLTask(
                id="task_03",
                name="Validation Strategy & Split",
                stage="preprocessing",
                description="Perform strictly chronological split for time-series forecasting, or stratified split for classification.",
                priority=30
            ),
            MLTask(
                id="task_04",
                name="Multi-Model Training & Comparison",
                stage="model_selection",
                description="Train and benchmark at least 2 distinct model families (e.g., Linear/Regularized vs. Tree-Based Ensemble XGBoost/Random Forest).",
                priority=40
            ),
            MLTask(
                id="task_05",
                name="Hyperparameter Tuning & Diagnostic Validation",
                stage="evaluation",
                description="Tune hyperparameters on the validation set, compute error metrics (RMSE/MAE/F1/ROC-AUC), and evaluate residuals.",
                priority=50
            ),
            MLTask(
                id="task_06",
                name="Executive Reporting & Artifact Export",
                stage="reporting",
                description="Export best model (.pkl), generate actual vs predicted visualizations, and compile narrative data story summary.",
                priority=60
            )
        ]
        return tasks


class TaskPrioritizationChain:
    """Dynamically re-prioritizes and injects new corrective tasks based on intermediate ML metrics."""

    @staticmethod
    def reprioritize(tasks: List[MLTask], last_task_result: Dict[str, Any]) -> List[MLTask]:
        # Exemplo: Se o modelo sofre de overfitting severo, injetar tarefa corretiva imediata
        if last_task_result.get("overfitting_detected", False):
            corrective_task = MLTask(
                id=f"task_corr_{len(tasks)+1}",
                name="Regularization & Cross-Validation Retuning",
                stage="model_selection",
                description="High train-val gap detected. Increase L1/L2 penalties, reduce tree depth, and apply 5-fold cross validation.",
                priority=45
            )
            tasks.append(corrective_task)
            logger.info("⚠️ Overfitting detetado: Tarefa de regularização injetada dinamicamente.")

        return sorted(tasks, key=lambda t: t.priority)


class MLExecutionEngine:
    """Executes each ML task using Python data science tools."""

    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def execute(self, task: MLTask, context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"⚡ [EXECUÇÃO] A executar: {task.name} ({task.id})")
        
        # Simulação controlada de execução de Data Science / ML
        if task.stage == "eda":
            return {
                "features_identified": 14,
                "outliers_count": 3,
                "missing_values_handled": True,
                "summary": "EDA concluída com sucesso: 14 variáveis analisadas, distribuições normais na maioria dos atributos."
            }
        elif task.stage == "preprocessing":
            return {
                "scaling_applied": "StandardScaler",
                "categorical_encoded": ["OneHotEncoder", "OrdinalEncoder"],
                "split_strategy": context.get("split_type", "stratified")
            }
        elif task.stage == "model_selection":
            return {
                "models_trained": ["ElasticNet / Ridge", "Random Forest / XGBoost"],
                "baseline_score": 0.78,
                "best_model": "Random Forest Regressor",
                "best_score": 0.91,
                "overfitting_detected": False
            }
        elif task.stage == "evaluation":
            return {
                "test_r2": 0.895,
                "test_rmse": 4.12,
                "test_mae": 2.87,
                "validation_passed": True
            }
        elif task.stage == "reporting":
            return {
                "model_path": os.path.join(self.output_dir, "best_model.pkl"),
                "plots_generated": ["feature_importance.png", "actual_vs_predicted.png"],
                "executive_summary": "Modelo campeão atinge R² de 89.5% e erro médio reduzido em 32% face à baseline."
            }

        return {"status": "ok"}


class AgentXMLCoordinator:
    """The Autonomous Coordinator: runs the BabyAGI + Auto-GPT execution loop until goal is achieved."""

    def __init__(self, objective: str, problem_type: str = "regression", output_dir: str = "./ml_output"):
        self.objective = objective
        self.problem_type = problem_type
        self.executor = MLExecutionEngine(output_dir)
        self.task_queue: List[MLTask] = TaskCreationChain.create_initial_tasks(objective, problem_type)
        self.history: List[Dict[str, Any]] = []

    def run(self) -> Dict[str, Any]:
        logger.info(f"🎯 [AGENTX-ML] Iniciando objetivo autónomo: \"{self.objective}\" (Tipo: {self.problem_type})")
        
        context: Dict[str, Any] = {"objective": self.objective, "problem_type": self.problem_type}

        while self.task_queue:
            current_task = self.task_queue.pop(0)
            current_task.status = "executing"
            
            # 1. Execução da Tarefa pelo Executor Tool
            result = self.executor.execute(current_task, context)
            current_task.result = result
            current_task.status = "completed"
            
            self.history.append({
                "taskId": current_task.id,
                "taskName": current_task.name,
                "stage": current_task.stage,
                "result": result
            })

            # 2. Re-priorização e Injeção Dinâmica de Novas Tarefas (BabyAGI Loop)
            self.task_queue = TaskPrioritizationChain.reprioritize(self.task_queue, result)

        logger.info("🏆 [AGENTX-ML] Todas as tarefas de Machine Learning foram concluídas com sucesso!")
        return {
            "objective": self.objective,
            "status": "completed",
            "stages_completed": len(self.history),
            "history": self.history
        }


if __name__ == "__main__":
    agent = AgentXMLCoordinator(
        objective="Prever consumo de energia e otimizar custos operacionais de frotas",
        problem_type="time_series"
    )
    final_report = agent.run()
    print(json.dumps(final_report, indent=2, ensure_ascii=False))

