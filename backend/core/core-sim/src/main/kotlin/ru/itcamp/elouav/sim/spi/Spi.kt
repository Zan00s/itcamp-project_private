package ru.itcamp.elouav.sim.spi

import ru.itcamp.elouav.sim.model.Action
import ru.itcamp.elouav.sim.model.BehaviorRule
import ru.itcamp.elouav.sim.model.NodeState

interface NodeTypeProvider {
    fun typeId(): String
    fun defaultState(): NodeState
    fun defaultActions(): List<Action>
    fun defaultBehavior(): List<BehaviorRule>
}

interface FormulaFunction {
    fun name(): String
    fun evaluate(args: List<Double>): Double
}

class NodeTypeRegistry(private val providers: List<NodeTypeProvider>) {
    private val byType = providers.associateBy { it.typeId() }

    fun get(typeId: String): NodeTypeProvider? = byType[typeId]
    fun all(): List<NodeTypeProvider> = providers
    fun register(provider: NodeTypeProvider): NodeTypeRegistry =
        NodeTypeRegistry(providers + provider)
}
