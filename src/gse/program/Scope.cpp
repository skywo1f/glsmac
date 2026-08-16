#include "Scope.h"

#include "common/Assert.h"

#include "Array.h"
#include "Call.h"
#include "Case.h"
#include "Catch.h"
#include "Control.h"
#include "Else.h"
#include "Expression.h"
#include "For.h"
#include "ForConditionExpressions.h"
#include "ForConditionInOf.h"
#include "If.h"
#include "Object.h"
#include "SimpleCondition.h"
#include "Statement.h"
#include "Switch.h"
#include "Try.h"
#include "Variable.h"
#include "While.h"

namespace gse {
namespace program {

namespace {

const bool OperandHasLocalBindings( const Operand* const operand );

const bool ExpressionHasLocalBindings( const Expression* const expression ) {
	return expression && (
		OperandHasLocalBindings( expression->a ) ||
		OperandHasLocalBindings( expression->b )
	);
}

const bool OperandHasLocalBindings( const Operand* const operand ) {
	if ( !operand ) {
		return false;
	}
	switch ( operand->type ) {
		case Operand::OT_VARIABLE:
			return ( (Variable*)operand )->hints != VH_NONE;
		case Operand::OT_ARRAY:
			for ( const auto* const element : ( (Array*)operand )->elements ) {
				if ( OperandHasLocalBindings( element ) ) {
					return true;
				}
			}
			return false;
		case Operand::OT_EXPRESSION:
			return ExpressionHasLocalBindings( (Expression*)operand );
		case Operand::OT_CALL: {
			const auto* const call = (Call*)operand;
			if ( OperandHasLocalBindings( call->callable ) ) {
				return true;
			}
			for ( const auto* const argument : call->arguments ) {
				if ( OperandHasLocalBindings( argument ) ) {
					return true;
				}
			}
			return false;
		}
		case Operand::OT_NOTHING:
		case Operand::OT_VALUE:
		case Operand::OT_OBJECT:
		case Operand::OT_SCOPE:
		case Operand::OT_FUNCTION:
		case Operand::OT_LOOP_CONTROL:
			return false;
		default:
			THROW( "unexpected operand type while inspecting scope" );
	}
}

const bool ConditionalHasLocalBindings( const Conditional* const conditional ) {
	switch ( conditional->conditional_type ) {
		case Conditional::CT_IF: {
			const auto* const value = (If*)conditional;
			return ExpressionHasLocalBindings( value->condition->expression ) ||
				( value->els && ConditionalHasLocalBindings( value->els ) );
		}
		case Conditional::CT_ELSE:
			return false;
		case Conditional::CT_WHILE:
			return ExpressionHasLocalBindings( ( (While*)conditional )->condition->expression );
		case Conditional::CT_FOR: {
			const auto* const condition = ( (For*)conditional )->condition;
			switch ( condition->for_type ) {
				case ForCondition::FCT_IN_OF:
					return ExpressionHasLocalBindings( ( (ForConditionInOf*)condition )->expression );
				case ForCondition::FCT_EXPRESSIONS: {
					const auto* const expressions = (ForConditionExpressions*)condition;
					return OperandHasLocalBindings( expressions->init ) ||
						ExpressionHasLocalBindings( expressions->check ) ||
						ExpressionHasLocalBindings( expressions->iterate );
				}
				default:
					THROW( "unexpected for condition type while inspecting scope" );
			}
		}
		case Conditional::CT_TRY: {
			const auto* const handlers = ( (Try*)conditional )->handlers->handlers;
			for ( const auto& handler : handlers->ordered_properties ) {
				if ( OperandHasLocalBindings( handler.second ) ) {
					return true;
				}
			}
			return false;
		}
		case Conditional::CT_CATCH: {
			const auto* const handlers = ( (Catch*)conditional )->handlers;
			for ( const auto& handler : handlers->ordered_properties ) {
				if ( OperandHasLocalBindings( handler.second ) ) {
					return true;
				}
			}
			return false;
		}
		case Conditional::CT_SWITCH: {
			const auto* const value = (Switch*)conditional;
			if ( ExpressionHasLocalBindings( value->condition->expression ) ) {
				return true;
			}
			for ( const auto* const switch_case : value->cases ) {
				if ( switch_case->condition && ExpressionHasLocalBindings( switch_case->condition->expression ) ) {
					return true;
				}
			}
			return false;
		}
		case Conditional::CT_CASE: {
			const auto* const value = (Case*)conditional;
			return value->condition && ExpressionHasLocalBindings( value->condition->expression );
		}
		default:
			THROW( "unexpected conditional type while inspecting scope" );
	}
}

const bool BodyHasLocalBindings( const std::vector< const Control* >& body ) {
	for ( const auto* const control : body ) {
		switch ( control->control_type ) {
			case Control::CT_STATEMENT:
				if ( OperandHasLocalBindings( ( (Statement*)control )->body ) ) {
					return true;
				}
				break;
			case Control::CT_CONDITIONAL:
				if ( ConditionalHasLocalBindings( (Conditional*)control ) ) {
					return true;
				}
				break;
			default:
				THROW( "unexpected control type while inspecting scope" );
		}
	}
	return false;
}

}

Scope::Scope( const si_t& si, const std::vector< const Control* >& body )
	: Operand( si, OT_SCOPE )
	, body( body )
	, m_has_local_bindings( BodyHasLocalBindings( body ) ) {}

Scope::~Scope() {
	for ( auto& it : body ) {
		delete it;
	}
}

const bool Scope::HasLocalBindings() const {
	return m_has_local_bindings;
}

const std::string Scope::ToString() const {
	return "{ ... }";
}
const std::string Scope::Dump( const size_t depth ) const {
	std::string result = Formatted( "Scope" + m_si.ToString() + "(", depth );
	for ( const auto& it : body ) {
		result += it->Dump( depth + 1 );
	}
	return result + Formatted( ")", depth );
}

}
}
