import os
import subprocess
import tkinter as tk
from tkinter import messagebox

# Archivo para guardar el contador de commits
ARCHIVO_CONTADOR = "contador.txt"

# Elementos sensibles que jamás deben subirse a GitHub
ELEMENTOS_PRIVADOS = [
    "03_Cuenta/",
    ".env",
    "01_backend/.env",
    "venv/",
    "__pycache__/",
]


def asegurar_gitignore():
    """Garantiza que el archivo .gitignore exista y contenga las reglas para ignorar archivos sensibles."""
    gitignore_path = ".gitignore"
    lineas_existentes = []

    if os.path.exists(gitignore_path):
        with open(gitignore_path, "r", encoding="utf-8") as f:
            lineas_existentes = [line.strip() for line in f.readlines()]

    nuevas_lineas = [
        item for item in ELEMENTOS_PRIVADOS if item not in lineas_existentes
    ]

    if nuevas_lineas:
        with open(gitignore_path, "a", encoding="utf-8") as f:
            if lineas_existentes and lineas_existentes[-1] != "":
                f.write("\n")
            for item in nuevas_lineas:
                f.write(f"{item}\n")


def desvincular_archivos_sensibles():
    """Remueve del índice de Git cualquier archivo o carpeta privada que haya sido rastreada por accidente."""
    for elemento in ELEMENTOS_PRIVADOS:
        subprocess.run(
            ["git", "rm", "-r", "--cached", elemento],
            capture_output=True,
            text=True,
        )


def obtener_siguiente_numero():
    """Lee el número del archivo contador.txt o lo inicia en 0."""
    if not os.path.exists(ARCHIVO_CONTADOR):
        with open(ARCHIVO_CONTADOR, "w", encoding="utf-8") as f:
            f.write("0")
        return 0

    with open(ARCHIVO_CONTADOR, "r", encoding="utf-8") as f:
        try:
            return int(f.read().strip())
        except ValueError:
            with open(ARCHIVO_CONTADOR, "w", encoding="utf-8") as f_write:
                f_write.write("0")
            return 0


def guardar_siguiente_numero(numero):
    """Guarda el siguiente número en el archivo contador."""
    with open(ARCHIVO_CONTADOR, "w", encoding="utf-8") as f:
        f.write(str(numero))


def ejecutar_git():
    """Asegura la protección de datos y sube los cambios a GitHub."""
    try:
        # 1. Proteger datos sensibles antes de ejecutar comandos de Git
        asegurar_gitignore()
        desvincular_archivos_sensibles()

        numero_commit = obtener_siguiente_numero()
        mensaje_commit = f"{numero_commit:02d}"

        # 2. Asegurar la rama 'main'
        subprocess.run(
            ["git", "branch", "-M", "main"], capture_output=True, text=True
        )

        # 3. Preparar archivos (git add .)
        resultado_add = subprocess.run(
            ["git", "add", "."], capture_output=True, text=True
        )
        if resultado_add.returncode != 0:
            raise Exception(f"Error en 'git add':\n{resultado_add.stderr}")

        # 4. Registrar cambios (git commit -m "XX")
        subprocess.run(
            ["git", "commit", "-m", mensaje_commit],
            capture_output=True,
            text=True,
        )

        # 5. Enviar a GitHub (git push -u origin main)
        resultado_push = subprocess.run(
            ["git", "push", "-u", "origin", "main"],
            capture_output=True,
            text=True,
        )

        if resultado_push.returncode != 0:
            raise Exception(f"Error en 'git push':\n{resultado_push.stderr}")

        # Actualizar contador de commits y vista de la ventana
        siguiente_num = numero_commit + 1
        guardar_siguiente_numero(siguiente_num)
        label_contador.config(
            text=f"Próximo commit será: {siguiente_num:02d}"
        )

        messagebox.showinfo(
            "Éxito",
            f"¡Archivos subidos a GitHub con éxito!\nCommit registrado: {mensaje_commit}",
        )

    except Exception as e:
        messagebox.showerror("Error en Git", f"Ocurrió un problema:\n{e}")


# --- Interfaz Gráfica Estándar ---
ventana = tk.Tk()
ventana.title("Asistente de Git")
ventana.geometry("350x200")

label_titulo = tk.Label(
    ventana, text="Sincronizador de Git", font=("Helvetica", 14, "bold")
)
label_titulo.pack(pady=15)

boton_subir = tk.Button(
    ventana,
    text="Subir Cambios a GitHub",
    command=ejecutar_git,
    font=("Helvetica", 10),
)
boton_subir.pack(pady=10, ipadx=10, ipady=5)

proximo_numero = obtener_siguiente_numero()
label_contador = tk.Label(
    ventana,
    text=f"Próximo commit será: {proximo_numero:02d}",
    font=("Helvetica", 9),
)
label_contador.pack(pady=10)

ventana.mainloop()