package ru.itcamp.elouav.sim.engine

import ru.itcamp.elouav.sim.spi.FormulaFunction

class FormulaEvaluator(
    functions: List<FormulaFunction> = emptyList(),
) {
    private val functions: MutableMap<String, FormulaFunction> =
        functions.associateBy { it.name() }.toMutableMap()

    fun registerFunction(fn: FormulaFunction) {
        functions[fn.name()] = fn
    }

    fun evaluate(formula: String, context: Map<String, Double>): Double {
        val expr = substitute(formula, context)
        return evalExpr(expr)
    }

    private fun substitute(formula: String, context: Map<String, Double>): String {
        var result = formula
        context.forEach { (key, value) ->
            result = result.replace(key, value.toString())
        }
        return result
    }

    private fun evalExpr(expr: String): Double {
        return try {
            val tokens = tokenize(expr)
            val (value, _) = parseExpr(tokens, 0)
            value
        } catch (e: Exception) {
            0.0
        }
    }

    private fun tokenize(expr: String): List<String> {
        val tokens = mutableListOf<String>()
        var i = 0
        while (i < expr.length) {
            val c = expr[i]
            when {
                c.isWhitespace() -> i++
                c.isDigit() || c == '.' -> {
                    var j = i
                    while (j < expr.length && (expr[j].isDigit() || expr[j] == '.')) j++
                    tokens.add(expr.substring(i, j))
                    i = j
                }
                listOf('+', '-', '*', '/', '(', ')', ',').contains(c) -> {
                    tokens.add(c.toString())
                    i++
                }
                c.isLetter() || c == '_' -> {
                    var j = i
                    while (j < expr.length && (expr[j].isLetter() || expr[j].isDigit() || expr[j] == '_' || expr[j] == '.')) j++
                    tokens.add(expr.substring(i, j))
                    i = j
                }
                else -> i++
            }
        }
        return tokens
    }

    private fun parseExpr(tokens: List<String>, pos: Int): Pair<Double, Int> {
        var (left, i) = parseTerm(tokens, pos)
        while (i < tokens.size && (tokens[i] == "+" || tokens[i] == "-")) {
            val op = tokens[i]
            val (right, next) = parseTerm(tokens, i + 1)
            left = if (op == "+") left + right else left - right
            i = next
        }
        return left to i
    }

    private fun parseTerm(tokens: List<String>, pos: Int): Pair<Double, Int> {
        var (left, i) = parseFactor(tokens, pos)
        while (i < tokens.size && (tokens[i] == "*" || tokens[i] == "/")) {
            val op = tokens[i]
            val (right, next) = parseFactor(tokens, i + 1)
            left = if (op == "*") left * right else left / right
            i = next
        }
        return left to i
    }

    private fun parseFactor(tokens: List<String>, pos: Int): Pair<Double, Int> {
        if (pos >= tokens.size) return 0.0 to pos

        if (tokens[pos] == "(") {
            val (value, next) = parseExpr(tokens, pos + 1)
            val end = if (next < tokens.size && tokens[next] == ")") next + 1 else next
            return value to end
        }

        val token = tokens[pos]
        if (token.contains(".")) {
            return token.toDouble() to (pos + 1)
        }
        token.toDoubleOrNull()?.let { return it to (pos + 1) }

        if (token.contains("(")) {
            val fnName = token.substringBefore("(")
            val fn = functions[fnName]
            if (fn != null) {
                val argEnd = token.indexOf(")")
                val args = token.substring(fnName.length + 1, argEnd)
                    .split(",")
                    .map { it.trim().toDoubleOrNull() ?: 0.0 }
                return fn.evaluate(args) to (pos + 1)
            }
        }

        return 0.0 to (pos + 1)
    }
}
