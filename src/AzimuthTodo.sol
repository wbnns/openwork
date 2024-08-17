// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AzimuthTodo {
    struct Todo {
        uint256 id;
        string content;
        string[] tags;
        bool isCompleted;
        uint256 createdAt; // New field for creation timestamp
    }

    mapping(address => Todo[]) private userTodos;
    mapping(address => uint256) private userTodoCount;

    event TodoCreated(address user, uint256 id, string content, string[] tags, uint256 createdAt);
    event TodoCompleted(address user, uint256 id);

    function createTodo(string memory _content, string[] memory _tags) public {
        uint256 newId = userTodoCount[msg.sender];
        uint256 createdAt = block.timestamp; // Get current timestamp
        userTodos[msg.sender].push(Todo(newId, _content, _tags, false, createdAt));
        userTodoCount[msg.sender]++;
        emit TodoCreated(msg.sender, newId, _content, _tags, createdAt);
    }

    function completeTodo(uint256 _id) public {
        require(_id < userTodoCount[msg.sender], "Todo does not exist");
        userTodos[msg.sender][_id].isCompleted = true;
        emit TodoCompleted(msg.sender, _id);
    }

    function getUserTodos(address _user, uint256 _offset, uint256 _limit) public view returns (Todo[] memory) {
        uint256 totalTodos = userTodoCount[_user];
        uint256 limit = _limit;
        if (_offset + limit > totalTodos) {
            limit = totalTodos - _offset;
        }
        Todo[] memory todos = new Todo[](limit);
        for (uint256 i = 0; i < limit; i++) {
            todos[i] = userTodos[_user][_offset + i];
        }
        return todos;
    }

    function getTodoCount(address _user) public view returns (uint256) {
        return userTodoCount[_user];
    }
}