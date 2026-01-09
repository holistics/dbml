expression "expression" = factors:factor* {
	return removeReduntdantSpNewline(_.flattenDeep(factors).join(""));
}
factor = factors:(character+ _ "(" expression ")"
	/ "(" expression ")"
	/ (exprCharNoCommaSpace+ &(_/","/");"/endline");")) / exprChar+ &.) {
	return _.flattenDeep(factors).join("");
}   
    
exprChar = [\"\',.a-z0-9_+-:<>=!*]i
	/ sp
	/ newline
	/ tab
exprCharNoCommaSpace = [\'.a-z0-9_+-]i